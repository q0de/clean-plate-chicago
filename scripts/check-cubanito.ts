import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkCubanito() {
  console.log("🔍 Checking Cubanito Express data...\n");

  // Find the establishment
  const { data: establishment } = await supabase
    .from('establishments')
    .select('*')
    .ilike('dba_name', '%CUBANITO%')
    .single();

  if (!establishment) {
    console.log("❌ Cubanito Express not found");
    return;
  }

  console.log("📍 Establishment:");
  console.log(`   Name: ${establishment.dba_name}`);
  console.log(`   Address: ${establishment.address}`);
  console.log(`   Latest Result: ${establishment.latest_result}`);
  console.log(`   Latest Date: ${establishment.latest_inspection_date}`);
  console.log(`   Total Inspections (field): ${establishment.total_inspections}`);

  // Get ALL inspections for this establishment
  const { data: inspections, count } = await supabase
    .from('inspections')
    .select('id, inspection_date, inspection_type, results, raw_violations, violation_count, critical_count', { count: 'exact' })
    .eq('establishment_id', establishment.id)
    .order('inspection_date', { ascending: false });

  console.log(`\n📋 Actual Inspections in DB: ${count}`);
  
  for (const insp of inspections || []) {
    console.log(`\n   [${insp.inspection_date}] ${insp.results}`);
    console.log(`   Type: ${insp.inspection_type}`);
    console.log(`   Violations: ${insp.violation_count} (${insp.critical_count} critical)`);
    
    // Get parsed violations for this inspection
    const { data: violations } = await supabase
      .from('violations')
      .select('violation_code, violation_description, is_critical')
      .eq('inspection_id', insp.id);
    
    if (violations && violations.length > 0) {
      console.log(`   Parsed violations (${violations.length}):`);
      for (const v of violations) {
        const desc = v.violation_description?.substring(0, 60) || 'N/A';
        console.log(`      - Code ${v.violation_code}: ${desc}... ${v.is_critical ? '⚠️ CRITICAL' : ''}`);
      }
    }
  }
}

checkCubanito();

