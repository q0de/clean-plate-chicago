/**
 * Regenerate AI summaries for establishments that have summaries but missing ai_summary_score
 * This fixes old summaries from before we added score tracking
 * 
 * Run with: node scripts/regenerate-ai-summaries.js
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

if (!openaiKey) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const openai = new OpenAI({ apiKey: openaiKey });

async function generateSummary(data) {
  const promptParts = [
    `Restaurant: ${data.dba_name} (${data.facility_type})`,
    `Official Chicago Inspection Result: ${data.latest_result}`,
    `CleanPlate Score (our calculated rating): ${data.cleanplate_score}/100`,
    `Violations from latest inspection: ${data.violation_count} total, ${data.critical_count} critical`,
  ];

  if (data.inspection_type) {
    promptParts.push(`Inspection type: ${data.inspection_type}`);
  }

  if (data.recent_inspections && data.recent_inspections.length > 1) {
    const history = data.recent_inspections.slice(0, 3).map((insp, idx) => {
      const date = new Date(insp.inspection_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${idx === 0 ? 'Latest' : idx === 1 ? 'Previous' : 'Earlier'} (${date}): ${insp.results} - ${insp.violation_count} violations (${insp.critical_count} critical)`;
    }).join('\n');
    promptParts.push(`\nRecent Inspection History:\n${history}`);
  }

  if (data.raw_violations) {
    promptParts.push(`\nViolation Details:\n${data.raw_violations.substring(0, 1000)}`);
  }

  const prompt = promptParts.join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
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
- "Fail" or "Failed" - the inspection failed`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return null;
  }
}

async function main() {
  console.log('Regenerating AI summaries for establishments with missing ai_summary_score...\n');

  // Get all establishments with summaries but missing ai_summary_score
  const { data: establishments, error } = await supabase
    .from('establishments')
    .select('id, dba_name, slug, cleanplate_score, latest_result, latest_inspection_date, facility_type')
    .not('ai_summary', 'is', null)
    .is('ai_summary_score', null)
    .order('dba_name');

  if (error) {
    console.error('Error fetching establishments:', error);
    process.exit(1);
  }

  if (!establishments || establishments.length === 0) {
    console.log('No establishments found that need regeneration.');
    process.exit(0);
  }

  console.log(`Found ${establishments.length} establishments to regenerate\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const est of establishments) {
    try {
      // Fetch latest inspection details
      const { data: inspections } = await supabase
        .from('inspections')
        .select('inspection_date, results, inspection_type, violation_count, critical_count, raw_violations')
        .eq('establishment_id', est.id)
        .order('inspection_date', { ascending: false })
        .limit(5);

      if (!inspections || inspections.length === 0) {
        console.log(`⚠️  Skipping ${est.dba_name} - no inspections found`);
        continue;
      }

      const latestInspection = inspections[0];
      const recentInspections = inspections.slice(0, 3).map(i => ({
        inspection_date: i.inspection_date,
        results: i.results,
        violation_count: i.violation_count || 0,
        critical_count: i.critical_count || 0,
      }));

      const summaryData = {
        dba_name: est.dba_name,
        facility_type: est.facility_type || 'Restaurant',
        latest_result: est.latest_result || latestInspection.results,
        cleanplate_score: est.cleanplate_score,
        violation_count: latestInspection.violation_count || 0,
        critical_count: latestInspection.critical_count || 0,
        raw_violations: latestInspection.raw_violations,
        inspection_type: latestInspection.inspection_type,
        latest_inspection_date: est.latest_inspection_date || latestInspection.inspection_date,
        recent_inspections,
      };

      console.log(`Regenerating summary for: ${est.dba_name} (score: ${est.cleanplate_score})...`);

      const newSummary = await generateSummary(summaryData);

      if (!newSummary) {
        console.log(`  ❌ Failed to generate summary`);
        errorCount++;
        continue;
      }

      // Update the database with new summary and score
      const { error: updateError } = await supabase
        .from('establishments')
        .update({
          ai_summary: newSummary,
          ai_summary_score: est.cleanplate_score,
          ai_summary_updated_at: new Date().toISOString(),
        })
        .eq('id', est.id);

      if (updateError) {
        console.log(`  ❌ Failed to update database: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Success`);
        successCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`  ❌ Error processing ${est.dba_name}:`, error.message || error);
      if (error.stack) {
        console.error(`     Stack: ${error.stack.split('\n')[0]}`);
      }
      errorCount++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
}

main().catch(console.error);

