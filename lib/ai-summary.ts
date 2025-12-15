import OpenAI from "openai";

// Lazy initialization - only create client when needed
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// In-memory cache for AI summaries (in production, use Redis or database)
const summaryCache = new Map<string, { summary: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

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

export async function generateAISummary(data: InspectionData): Promise<string> {
  // Include score in cache key so updates to score bust the cache
  const cacheKey = `${data.dba_name}-${data.latest_inspection_date}-${data.cleanplate_score}-${data.violation_count}`;
  
  // Check cache first
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.summary;
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
          content: `You are a helpful assistant that writes concise, informative 2-3 sentence summaries of restaurant health inspection results for consumers. Be direct, factual, and focus on what matters most to someone deciding whether to eat there. Include context about trends if relevant (improving, declining, consistent issues). Don't be overly alarming but be honest. Use plain language. Aim for 200-300 characters.`
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
    
    // Cache the result
    summaryCache.set(cacheKey, { summary, timestamp: Date.now() });
    
    return summary;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return generateFallbackSummary(data);
  }
}

function buildPrompt(data: InspectionData): string {
  const parts = [
    `Restaurant: ${data.dba_name} (${data.facility_type})`,
    `Latest Inspection Result: ${data.latest_result}`,
    `CleanPlate Score: ${data.cleanplate_score}/100`,
    `Latest Violations: ${data.violation_count} total, ${data.critical_count} critical`,
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

  parts.push(`\nWrite a consumer-friendly summary (2-3 sentences, 200-300 chars) that highlights the most important information for someone deciding whether to eat here. Include trend context if the inspection history shows improvement or decline.`);

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


