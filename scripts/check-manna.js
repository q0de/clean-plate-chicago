require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  // Find Manna Bakehouse
  const { data: est } = await supabase
    .from('establishments')
    .select('id, dba_name')
    .ilike('dba_name', '%manna%')
    .limit(5);
  
  console.log('Found establishments:', est?.map(e => e.dba_name));
  
  const mannaId = est?.find(e => e.dba_name.toLowerCase().includes('manna'))?.id;
  if (!mannaId) { console.log('Not found'); return; }
  
  // Get recent inspections with violations
  const { data: inspections } = await supabase
    .from('inspections')
    .select('id, inspection_date, results, raw_violations')
    .eq('establishment_id', mannaId)
    .order('inspection_date', { ascending: false })
    .limit(5);
  
  console.log('\n=== Recent Inspections ===');
  for (const insp of inspections || []) {
    console.log('\n📅', insp.inspection_date, '-', insp.results);
    
    // Get parsed violations
    const { data: violations } = await supabase
      .from('violations')
      .select('violation_code, description')
      .eq('inspection_id', insp.id);
    
    console.log('Parsed violations:', violations?.length || 0);
    violations?.forEach(v => console.log('  Code', v.violation_code, ':', v.description?.substring(0, 80)));
    
    // Check raw_violations for keywords
    const text = (insp.raw_violations || '').toLowerCase();
    console.log('\nKeyword check in raw_violations:');
    console.log('  water:', text.includes('water'));
    console.log('  sewage:', text.includes('sewage'));
    console.log('  plumbing:', text.includes('plumbing'));
    console.log('  rat/rodent/pest:', /\b(rodent|mouse|mice|rat|pest|insect|roach|fly|flies|droppings)\b/.test(text));
    console.log('  temperature:', text.includes('temperature'));
    console.log('  cold holding:', text.includes('cold holding'));
    
    // Find where 'water' appears
    if (text.includes('water')) {
      const matches = text.match(/.{0,40}water.{0,40}/g);
      console.log('\n  WATER context:');
      matches?.forEach(m => console.log('    "...' + m + '..."'));
    }
  }
}
check();

