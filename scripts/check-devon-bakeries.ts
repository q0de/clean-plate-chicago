import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  console.log("🔍 Checking bakeries at 2944 W Devon Ave...\n");

  // Find all establishments at this address
  const { data: establishments } = await supabase
    .from('establishments')
    .select('id, dba_name, aka_name, license_number, address, latest_result, latest_inspection_date, facility_type')
    .ilike('address', '%2944%DEVON%');

  console.log(`📍 Found ${establishments?.length} establishments at this address:\n`);

  for (const est of establishments || []) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Name: ${est.dba_name}`);
    console.log(`AKA: ${est.aka_name || 'N/A'}`);
    console.log(`License: ${est.license_number}`);
    console.log(`Type: ${est.facility_type}`);
    console.log(`Latest Result: ${est.latest_result}`);
    console.log(`Latest Date: ${est.latest_inspection_date}`);
    
    // Get inspections
    const { data: inspections } = await supabase
      .from('inspections')
      .select('inspection_date, results, inspection_type, violation_count')
      .eq('establishment_id', est.id)
      .order('inspection_date', { ascending: false })
      .limit(3);
    
    console.log(`\nRecent inspections:`);
    for (const insp of inspections || []) {
      console.log(`   ${insp.inspection_date} | ${insp.results} | ${insp.inspection_type} | ${insp.violation_count} violations`);
    }
    console.log('');
  }
}

check();

