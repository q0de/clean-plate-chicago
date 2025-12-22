require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  // Find Manna Bakehouse
  const { data: est } = await supabase
    .from('establishments')
    .select('id, dba_name')
    .ilike('dba_name', '%manna%')
    .single();
  
  console.log('Establishment:', est?.dba_name);
  
  // Get the latest inspection
  const { data: inspection } = await supabase
    .from('inspections')
    .select('id, inspection_date, results, raw_violations')
    .eq('establishment_id', est?.id)
    .order('inspection_date', { ascending: false })
    .limit(1)
    .single();
  
  console.log('\n📅 Latest:', inspection?.inspection_date, '-', inspection?.results);
  console.log('\n=== FULL RAW_VIOLATIONS TEXT ===\n');
  console.log(inspection?.raw_violations);
  console.log('\n================================\n');
}
check();

