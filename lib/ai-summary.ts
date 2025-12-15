import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
}

export async function generateAISummary(data: InspectionData): Promise<string> {
  const cacheKey = `${data.dba_name}-${data.latest_inspection_date}-${data.violation_count}`;
  
  // Check cache first
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.summary;
  }

  // If no API key, return fallback
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackSummary(data);
  }

  try {
    const prompt = buildPrompt(data);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that writes concise, informative 1-2 sentence summaries of restaurant health inspection results for consumers. Be direct, factual, and focus on what matters most to someone deciding whether to eat there. Don't be overly alarming but be honest. Use plain language. Never exceed 150 characters.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 60,
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
    `Result: ${data.latest_result}`,
    `Score: ${data.cleanplate_score}/100`,
    `Violations: ${data.violation_count} total, ${data.critical_count} critical`,
  ];

  if (data.inspection_type) {
    parts.push(`Inspection type: ${data.inspection_type}`);
  }

  if (data.raw_violations) {
    // Truncate violations to avoid token limits
    const truncated = data.raw_violations.slice(0, 500);
    parts.push(`Key issues: ${truncated}`);
  }

  parts.push(`Write a brief consumer-friendly summary (1-2 sentences, max 150 chars).`);

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


