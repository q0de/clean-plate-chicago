import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Parse violations from raw text (same logic as sync-inspections)
 */
function parseViolations(violationsString: string): Array<{
  code: string;
  description: string;
  comment: string | null;
  is_critical: boolean;
}> {
  if (!violationsString) return [];

  // Violations are pipe-delimited
  const parts = violationsString.split("|").filter((p) => p.trim());

  return parts.map((part) => {
    // Format: "Code X. DESCRIPTION - Comments: COMMENT TEXT"
    // Or: "X. DESCRIPTION - Comments: COMMENT TEXT"
    const codeMatch = part.match(/^\s*(\d+)\.\s*/);
    const code = codeMatch ? codeMatch[1] : "";

    // Extract description (everything after code, before "- Comments:")
    let description = "";
    let comment: string | null = null;

    const commentSplit = part.split(/\s*-\s*Comments?:\s*/i);
    if (commentSplit.length >= 2) {
      // Has comments section
      const beforeComments = commentSplit[0];
      comment = commentSplit.slice(1).join(" - Comments: ").trim();
      
      // Extract description from before comments
      const descMatch = beforeComments.match(/^\s*\d+\.\s*(.+)/);
      description = descMatch ? descMatch[1].trim() : beforeComments.trim();
    } else {
      // No comments section
      const descMatch = part.match(/^\s*\d+\.\s*(.+)/);
      description = descMatch ? descMatch[1].trim() : part.trim();
    }

    // Determine if critical (codes 1-14 are typically critical)
    const codeNum = parseInt(code);
    const is_critical = codeNum >= 1 && codeNum <= 14;

    return {
      code,
      description,
      comment,
      is_critical,
    };
  }).filter(v => v.code); // Only return violations with valid codes
}

async function backfillViolations() {
  console.log("🚀 Starting violations backfill...\n");

  // Get unique inspection IDs that already have violations
  const { data: existingViolations } = await supabase
    .from("violations")
    .select("inspection_id");

  const existingIds = new Set(existingViolations?.map(v => v.inspection_id) || []);
  console.log(`✅ Found ${existingIds.size} inspections with existing violations (will skip)`);

  // Get inspections that have raw_violations but NO parsed violations
  const { data: inspections, error } = await supabase
    .from("inspections")
    .select("id, inspection_date, raw_violations")
    .not("raw_violations", "is", null)
    .order("inspection_date", { ascending: false });

  if (error) {
    console.error("Error fetching inspections:", error);
    return;
  }

  // Filter to only those missing parsed violations
  const needsBackfill = inspections?.filter(
    (insp) => !existingIds.has(insp.id)
  ) || [];

  console.log(`📋 Found ${needsBackfill.length} inspections needing backfill\n`);

  if (needsBackfill.length === 0) {
    console.log("✅ Nothing to backfill!");
    return;
  }

  let processed = 0;
  let totalViolationsInserted = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < needsBackfill.length; i += BATCH_SIZE) {
    const batch = needsBackfill.slice(i, i + BATCH_SIZE);
    const allViolations: Array<{
      inspection_id: string;
      violation_code: string;
      violation_description: string;
      violation_comment: string | null;
      is_critical: boolean;
    }> = [];

    for (const inspection of batch) {
      const violations = parseViolations(inspection.raw_violations || "");
      
      for (const v of violations) {
        allViolations.push({
          inspection_id: inspection.id,
          violation_code: v.code,
          violation_description: v.description,
          violation_comment: v.comment,
          is_critical: v.is_critical,
        });
      }
      
      processed++;
    }

    if (allViolations.length > 0) {
      const { error: insertError } = await supabase
        .from("violations")
        .upsert(allViolations, {
          onConflict: 'inspection_id,violation_code',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error(`❌ Error inserting batch:`, insertError.message);
        errors++;
      } else {
        totalViolationsInserted += allViolations.length;
      }
    }

    // Progress update
    const progress = Math.round((processed / needsBackfill.length) * 100);
    process.stdout.write(`\r⏳ Progress: ${processed}/${needsBackfill.length} inspections (${progress}%) - ${totalViolationsInserted} violations inserted`);
  }

  console.log("\n\n" + "=".repeat(60));
  console.log(`\n✅ Backfill complete!`);
  console.log(`   📊 Inspections processed: ${processed}`);
  console.log(`   📝 Violations inserted: ${totalViolationsInserted}`);
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors}`);
  }
}

backfillViolations().catch(console.error);

