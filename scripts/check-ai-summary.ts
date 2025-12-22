import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Same theme extraction logic as the API
function extractViolationThemesFromCodes(violations: { violation_code: string; is_critical: boolean }[]): string[] {
  if (!violations || violations.length === 0) return [];
  
  const themes: string[] = [];
  const codes = violations.map(v => parseInt(v.violation_code));
  
  console.log("   Violation codes found:", codes);
  
  // Check for pest violations (code 38)
  if (codes.includes(38)) {
    themes.push("🐭 Pest issues");
  }
  
  // Check for food safety/temperature violations (codes 6-20)
  if (codes.some(c => c >= 6 && c <= 20)) {
    themes.push("🌡️ Temperature control");
  }
  
  // Check for contamination violations (codes 21-31)
  if (codes.some(c => c >= 21 && c <= 31)) {
    themes.push("🧹 Cleanliness");
  }
  
  // Check for storage/labeling violations (codes 32-37)
  if (codes.some(c => c >= 32 && c <= 37)) {
    themes.push("📦 Storage");
  }
  
  // Check for chemical safety violations (codes 39-42)
  if (codes.some(c => c >= 39 && c <= 42)) {
    themes.push("⚠️ Chemical safety");
  }
  
  // Check for facilities violations (codes 43-58)
  if (codes.some(c => c >= 43 && c <= 58)) {
    themes.push("🔧 Equipment");
  }
  
  // Check for staff/certification violations (codes 1-5)
  if (codes.some(c => c >= 1 && c <= 5)) {
    themes.push("📋 Documentation");
  }
  
  return themes.slice(0, 4);
}

async function checkAISummary() {
  console.log("🔍 Checking AI Summary logic for Cubanito Express...\n");

  // Find the establishment
  const { data: establishment } = await supabase
    .from('establishments')
    .select('id, dba_name, slug')
    .ilike('dba_name', '%CUBANITO%')
    .single();

  if (!establishment) {
    console.log("❌ Cubanito Express not found");
    return;
  }

  console.log(`📍 ${establishment.dba_name} (slug: ${establishment.slug})`);

  // Get latest inspection
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, inspection_date, results, raw_violations')
    .eq('establishment_id', establishment.id)
    .order('inspection_date', { ascending: false })
    .limit(1);

  const latestInspection = inspections?.[0];
  
  if (!latestInspection) {
    console.log("❌ No inspections found");
    return;
  }

  console.log(`\n📋 Latest Inspection: ${latestInspection.inspection_date} - ${latestInspection.results}`);

  // Get violations for this inspection
  const { data: violations } = await supabase
    .from('violations')
    .select('violation_code, is_critical')
    .eq('inspection_id', latestInspection.id);

  console.log(`\n🔢 Violations in DB:`);
  violations?.forEach(v => console.log(`   - Code ${v.violation_code}`));

  // Run theme extraction
  console.log(`\n🎯 Theme extraction result:`);
  const themes = extractViolationThemesFromCodes(violations || []);
  console.log(`   Themes: ${themes.length > 0 ? themes.join(', ') : 'None'}`);

  // Also check raw_violations text
  console.log(`\n📝 Raw violations text:`);
  console.log(`   ${latestInspection.raw_violations?.substring(0, 200)}...`);
}

checkAISummary();

