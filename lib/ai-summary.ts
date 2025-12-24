import OpenAI from "openai";
import { supabase } from "./supabase";

// Lazy initialization - only create client when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// In-memory cache as a fast first layer (backed by database)
const summaryCache = new Map<string, { summary: string; timestamp: number }>();
const MEMORY_CACHE_TTL = 1000 * 60 * 60; // 1 hour in memory
const DB_CACHE_TTL_DAYS = 7; // 7 days in database (but auto-invalidated on new inspections)

/**
 * Clear cached summary for an establishment (call when new inspection added)
 */
export function invalidateSummaryCache(establishmentId: string): void {
  summaryCache.delete(establishmentId);
}

/**
 * Clear all cached summaries (use sparingly)
 */
export function clearAllSummaryCache(): void {
  summaryCache.clear();
}

interface InspectionData {
  dba_name: string;
  facility_type: string;
  latest_result: string;
  cleanplate_score: number;
  violation_count: number;
  critical_count: number;
  raw_violations: string | null;
  inspection_type: string | null;
  latest_inspection_date: string | null;
  recent_inspections?: Array<{
    inspection_date: string;
    results: string;
    violation_count: number;
    critical_count: number;
  }>;
}

/**
 * Get cached AI summary from database (with memory cache layer)
 */
export async function getCachedSummary(establishmentId: string): Promise<string | null> {
  // Check memory cache first (fast)
  const memCached = summaryCache.get(establishmentId);
  if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL) {
    return memCached.summary;
  }

  // Check database cache
  const { data } = await supabase
    .from("establishments")
    .select("ai_summary, ai_summary_updated_at")
    .eq("id", establishmentId)
    .single();

  if (data?.ai_summary && data?.ai_summary_updated_at) {
    const updatedAt = new Date(data.ai_summary_updated_at);
    const ageInDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < DB_CACHE_TTL_DAYS) {
      // Cache in memory for faster subsequent access
      summaryCache.set(establishmentId, { summary: data.ai_summary, timestamp: Date.now() });
      return data.ai_summary;
    }
  }

  return null;
}

/**
 * Save AI summary to database cache
 */
export async function cacheSummary(
  establishmentId: string, 
  summary: string, 
  score?: number  // Optional for backward compatibility
): Promise<void> {
  // Update memory cache
  summaryCache.set(establishmentId, { summary, timestamp: Date.now() });

  // Update database cache
  await supabase
    .from("establishments")
    .update({
      ai_summary: summary,
      ai_summary_score: score ?? null,  // NULL if not provided
      ai_summary_updated_at: new Date().toISOString(),
    })
    .eq("id", establishmentId);
}

export async function generateAISummary(data: InspectionData & { establishment_id?: string }): Promise<string> {
  // Check database cache first if we have an establishment ID
  if (data.establishment_id) {
    const cached = await getCachedSummary(data.establishment_id);
    if (cached) {
      return cached;
    }
  }

  // Legacy memory-only cache key for backwards compatibility
  const cacheKey = `${data.dba_name}-${data.latest_inspection_date}-${data.cleanplate_score}-${data.violation_count}`;
  const memCached = summaryCache.get(cacheKey);
  if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL) {
    return memCached.summary;
  }

  // If no API key, return fallback
  const openai = getOpenAIClient();
  if (!openai) {
    return generateFallbackSummary(data);
  }

  try {
    const prompt = buildPrompt(data);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that writes concise, informative 2-3 sentence summaries of restaurant health inspection results for consumers. Be direct, factual, and focus on what matters most to someone deciding whether to eat there. Include context about trends if relevant (improving, declining, consistent issues). Don't be overly alarming but be honest. Use plain language. Aim for 200-300 characters.

CRITICAL DISTINCTION - Two different things:
1. Chicago's Official Result: The city issues only Pass, Conditional Pass, or Fail - NO numeric score
2. CleanPlate Score: Our proprietary 0-100 rating calculated from inspection history, violations, recency, and trends

NEVER say things like "scoring X/100 on their inspection" - Chicago doesn't give scores!
CORRECT phrasing examples:
- "received a Conditional Pass from Chicago inspectors. CleanPlate rates them 61/100 based on..."
- "passed their latest Chicago inspection. With a CleanPlate score of 85, they show..."
- "failed their Chicago inspection. CleanPlate rates them 35/100 due to..."

Inspection result terminology:
- "Pass" or "Passed" - the inspection passed
- "Conditional Pass" - its own result type (NOT "passed with conditions")
- "Fail" or "Failed" - the inspection failed`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || generateFallbackSummary(data);
    
    // Cache the result in memory
    summaryCache.set(cacheKey, { summary, timestamp: Date.now() });
    
    // Cache in database if we have establishment ID
    if (data.establishment_id) {
      await cacheSummary(data.establishment_id, summary, data.cleanplate_score);
    }
    
    return summary;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return generateFallbackSummary(data);
  }
}

function buildPrompt(data: InspectionData): string {
  const parts = [
    `Restaurant: ${data.dba_name} (${data.facility_type})`,
    `Official Chicago Inspection Result: ${data.latest_result}`,
    `CleanPlate Score (our calculated rating): ${data.cleanplate_score}/100`,
    `Violations from latest inspection: ${data.violation_count} total, ${data.critical_count} critical`,
  ];

  if (data.inspection_type) {
    parts.push(`Inspection type: ${data.inspection_type}`);
  }

  // Include recent inspection history for trend context
  if (data.recent_inspections && data.recent_inspections.length > 1) {
    const history = data.recent_inspections.slice(0, 3).map((insp, idx) => {
      const date = new Date(insp.inspection_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${idx === 0 ? 'Latest' : idx === 1 ? 'Previous' : 'Earlier'} (${date}): ${insp.results} - ${insp.violation_count} violations (${insp.critical_count} critical)`;
    }).join('\n');
    parts.push(`\nRecent Inspection History:\n${history}`);
  }

  if (data.raw_violations) {
    // Increase truncation limit for more context
    const truncated = data.raw_violations.slice(0, 1000);
    parts.push(`\nKey Violation Details: ${truncated}`);
  }

  parts.push(`\nWrite a consumer-friendly summary (2-3 sentences, 200-300 chars) that highlights the most important information for someone deciding whether to eat here. Include trend context if the inspection history shows improvement or decline. Remember: Chicago gives Pass/Conditional/Fail only - the numeric score is CleanPlate's rating.`);

  return parts.join("\n");
}

function generateFallbackSummary(data: InspectionData): string {
  const isPass = data.latest_result.toLowerCase().includes("pass") && !data.latest_result.toLowerCase().includes("fail");
  const isConditional = data.latest_result.toLowerCase().includes("condition");
  
  if (isPass && data.violation_count === 0) {
    return "Clean inspection with no issues found.";
  } else if (isPass && data.critical_count === 0) {
    return `Passed with ${data.violation_count} minor note${data.violation_count > 1 ? "s" : ""}.`;
  } else if (isPass) {
    return `Passed but ${data.critical_count} item${data.critical_count > 1 ? "s" : ""} need attention.`;
  } else if (isConditional) {
    return `Conditional pass - follow-up required for ${data.violation_count} issue${data.violation_count > 1 ? "s" : ""}.`;
  } else {
    return `Did not pass. ${data.violation_count} violation${data.violation_count > 1 ? "s" : ""} found.`;
  }
}

// Batch generate summaries for multiple restaurants
export async function generateBatchSummaries(
  restaurants: InspectionData[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Process in parallel with a limit
  const batchSize = 5;
  for (let i = 0; i < restaurants.length; i += batchSize) {
    const batch = restaurants.slice(i, i + batchSize);
    const summaries = await Promise.all(
      batch.map(async (r) => {
        const summary = await generateAISummary(r);
        return { name: r.dba_name, summary };
      })
    );
    summaries.forEach(({ name, summary }) => results.set(name, summary));
  }
  
  return results;
}

// Extract violation themes from raw violations text
export function extractViolationThemes(rawViolations: string | null): string[] {
  if (!rawViolations) return [];
  
  const themes: string[] = [];
  const lowerText = rawViolations.toLowerCase();
  
  // Common violation categories to look for
  const themeMap: Record<string, string> = {
    "food temperature": "Temperature Control",
    "cold holding": "Temperature Control",
    "hot holding": "Temperature Control",
    "cross contamination": "Cross Contamination",
    "cross-contamination": "Cross Contamination",
    "raw meat": "Cross Contamination",
    "hand wash": "Handwashing",
    "handwash": "Handwashing",
    "rodent": "Pest Control",
    "roach": "Pest Control",
    "pest": "Pest Control",
    "mouse": "Pest Control",
    "mice": "Pest Control",
    "droppings": "Pest Control",
    "insect": "Pest Control",
    "flies": "Pest Control",
    "sanitiz": "Sanitization",
    "disinfect": "Sanitization",
    "clean": "Cleanliness",
    "dirty": "Cleanliness",
    "debris": "Cleanliness",
    "grease": "Cleanliness",
    "food storage": "Food Storage",
    "properly labeled": "Labeling",
    "label": "Labeling",
    "expired": "Expired Products",
    "past date": "Expired Products",
    "certificate": "Documentation",
    "license": "Documentation",
    "permit": "Documentation",
    "no city of chicago": "Documentation",
    "sewage": "Plumbing",
    "plumbing": "Plumbing",
    "drain": "Plumbing",
    "toxic": "Chemical Safety",
    "chemical": "Chemical Safety",
    "ventilation": "Ventilation",
    "equipment": "Equipment Issues",
    "refrigerat": "Equipment Issues",
    "thermometer": "Equipment Issues",
  };
  
  for (const [keyword, theme] of Object.entries(themeMap)) {
    if (lowerText.includes(keyword) && !themes.includes(theme)) {
      themes.push(theme);
    }
  }
  
  // Limit to top 4 themes
  return themes.slice(0, 4);
}


