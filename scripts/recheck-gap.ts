import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function recheck() {
  console.log("🔍 Rechecking violations gap...\n");

  // Count inspections with raw_violations
  const { data: inspectionsWithRaw } = await supabase
    .from('inspections')
    .select('id')
    .not('raw_violations', 'is', null);
  
  console.log(`📝 Inspections with raw_violations: ${inspectionsWithRaw?.length}`);

  // For each inspection, check if it has violations
  let hasViolations = 0;
  let noViolations = 0;
  
  for (const insp of inspectionsWithRaw || []) {
    const { count } = await supabase
      .from('violations')
      .select('*', { count: 'exact', head: true })
      .eq('inspection_id', insp.id);
    
    if (count && count > 0) {
      hasViolations++;
    } else {
      noViolations++;
    }
  }

  console.log(`✅ With parsed violations: ${hasViolations}`);
  console.log(`❌ Without parsed violations: ${noViolations}`);
}

recheck();

