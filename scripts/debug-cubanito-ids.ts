import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debug() {
  console.log("🔍 Debugging Cubanito Express IDs...\n");

  // Find ALL establishments matching "CUBANITO"
  const { data: establishments } = await supabase
    .from('establishments')
    .select('id, dba_name, slug, address')
    .ilike('dba_name', '%CUBANITO%');

  console.log(`📍 Establishments matching "CUBANITO": ${establishments?.length}`);
  
  for (const est of establishments || []) {
    console.log(`\n   ID: ${est.id}`);
    console.log(`   Name: ${est.dba_name}`);
    console.log(`   Slug: ${est.slug}`);
    console.log(`   Address: ${est.address}`);
    
    // Get inspections for this establishment
    const { data: inspections } = await supabase
      .from('inspections')
      .select('id, inspection_date, results')
      .eq('establishment_id', est.id)
      .order('inspection_date', { ascending: false });
    
    console.log(`   Inspections: ${inspections?.length}`);
    for (const insp of inspections || []) {
      console.log(`      - ${insp.id} | ${insp.inspection_date} | ${insp.results}`);
      
      // Check violations for this inspection
      const { count } = await supabase
        .from('violations')
        .select('*', { count: 'exact', head: true })
        .eq('inspection_id', insp.id);
      
      console.log(`        Violations: ${count}`);
    }
  }

  // Also check which inspection_id "5b93c517-f231-4f29-8606-ada154a4fe10" belongs to
  console.log("\n🔍 Checking inspection ID 5b93c517-f231-4f29-8606-ada154a4fe10:");
  const { data: specificInsp } = await supabase
    .from('inspections')
    .select('*, establishments(dba_name, slug)')
    .eq('id', '5b93c517-f231-4f29-8606-ada154a4fe10')
    .single();
  
  if (specificInsp) {
    console.log(`   Found: ${specificInsp.inspection_date}`);
    console.log(`   Establishment: ${(specificInsp as any).establishments?.dba_name}`);
    console.log(`   Slug: ${(specificInsp as any).establishments?.slug}`);
  } else {
    console.log("   Not found!");
  }
}

debug();

