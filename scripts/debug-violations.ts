import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debug() {
  // Get a sample inspection that should have been backfilled
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, inspection_date, raw_violations')
    .not('raw_violations', 'is', null)
    .order('inspection_date', { ascending: false })
    .limit(5);
  
  console.log('Sample inspections:');
  for (const insp of inspections || []) {
    console.log(`\nInspection ID: ${insp.id}`);
    console.log(`Date: ${insp.inspection_date}`);
    console.log(`Raw violations preview: ${insp.raw_violations?.substring(0, 100)}...`);
    
    // Check if this inspection has violations
    const { data: violations, count } = await supabase
      .from('violations')
      .select('*', { count: 'exact' })
      .eq('inspection_id', insp.id);
    
    console.log(`Parsed violations count: ${count}`);
  }
}

debug();

