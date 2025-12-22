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

async function checkViolationsGap() {
  console.log("🔍 Checking for inspections missing parsed violations...\n");

  // Get total inspections
  const { count: totalInspections } = await supabase
    .from("inspections")
    .select("*", { count: "exact", head: true });

  console.log(`📊 Total inspections in database: ${totalInspections?.toLocaleString()}`);

  // Get inspections with raw_violations
  const { count: withRawViolations } = await supabase
    .from("inspections")
    .select("*", { count: "exact", head: true })
    .not("raw_violations", "is", null);

  console.log(`📝 Inspections with raw_violations text: ${withRawViolations?.toLocaleString()}`);

  // Get unique inspection IDs that have violations
  const { data: inspectionsWithViolations } = await supabase
    .from("violations")
    .select("inspection_id");

  const uniqueInspectionIds = new Set(inspectionsWithViolations?.map(v => v.inspection_id) || []);
  console.log(`✅ Inspections with parsed violations: ${uniqueInspectionIds.size.toLocaleString()}`);

  // Get inspections that have raw_violations but NO parsed violations
  const { data: missingViolations, error } = await supabase
    .from("inspections")
    .select("id, inspection_date, raw_violations")
    .not("raw_violations", "is", null)
    .order("inspection_date", { ascending: true });

  if (error) {
    console.error("Error fetching inspections:", error);
    return;
  }

  // Filter to only those missing parsed violations
  const needsBackfill = missingViolations?.filter(
    (insp) => !uniqueInspectionIds.has(insp.id)
  ) || [];

  console.log(`\n❌ Inspections MISSING parsed violations: ${needsBackfill.length.toLocaleString()}`);

  if (needsBackfill.length > 0) {
    const dates = needsBackfill.map(i => new Date(i.inspection_date));
    const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
    const newest = new Date(Math.max(...dates.map(d => d.getTime())));

    console.log(`\n📅 Date range of missing violations:`);
    console.log(`   Oldest: ${oldest.toLocaleDateString()}`);
    console.log(`   Newest: ${newest.toLocaleDateString()}`);

    // Sample some raw violations to see what they look like
    console.log(`\n📋 Sample raw_violations text (first 3):`);
    needsBackfill.slice(0, 3).forEach((insp, i) => {
      const preview = insp.raw_violations?.substring(0, 200) + "...";
      console.log(`\n   ${i + 1}. [${insp.inspection_date}]`);
      console.log(`      ${preview}`);
    });
  }

  console.log("\n" + "=".repeat(60));
  if (needsBackfill.length > 0) {
    console.log(`\n⚠️  ACTION NEEDED: ${needsBackfill.length.toLocaleString()} inspections need backfilling`);
    console.log(`   Run the backfill script to parse violations into the database.`);
  } else {
    console.log(`\n✅ All inspections have parsed violations! No action needed.`);
  }
}

checkViolationsGap().catch(console.error);

