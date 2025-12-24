// Backfill violations for inspections that have raw_violations but no parsed violations
// Run with: node scripts/backfill-violations.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse violations string into individual violations
function parseViolations(violationsText) {
  if (!violationsText) return [];
  
  const violations = [];
  // Format: "CODE. DESCRIPTION - Comments: COMMENT | CODE. DESCRIPTION..."
  const parts = violationsText.split(' | ');
  
  for (const part of parts) {
    // More flexible regex that handles dashes in description
    const match = part.match(/^(\d+)\.\s*(.+?)\s*-\s*Comments:\s*(.*)$/i);
    if (match) {
      const code = match[1];
      const description = match[2].trim();
      const comment = match[3].trim();
      
      // Critical violations are typically codes 1-29 (excluding 15) in Chicago's system
      const codeNum = parseInt(code);
      const isCritical = codeNum >= 1 && codeNum <= 29 && codeNum !== 15;
      
      violations.push({
        violation_code: code,
        violation_description: description,
        violation_comment: comment,
        is_critical: isCritical,
      });
    }
  }
  
  return violations;
}

async function backfillViolations() {
  console.log('Finding inspections with missing violations...');
  
  // Get inspections that have raw_violations but no violations in the table
  const { data: inspections, error } = await supabase
    .rpc('get_inspections_missing_violations');
  
  // If RPC doesn't exist, use a direct query approach
  if (error) {
    console.log('Using direct query approach...');
    
    // Fetch in batches
    let offset = 0;
    const batchSize = 100;
    let totalProcessed = 0;
    let totalViolationsAdded = 0;
    
    while (true) {
      const { data: batch, error: batchError } = await supabase
        .from('inspections')
        .select('id, raw_violations')
        .not('raw_violations', 'is', null)
        .range(offset, offset + batchSize - 1);
      
      if (batchError) {
        console.error('Error fetching batch:', batchError);
        break;
      }
      
      if (!batch || batch.length === 0) {
        console.log('No more inspections to process');
        break;
      }
      
      for (const inspection of batch) {
        // Check if this inspection already has violations
        const { count } = await supabase
          .from('violations')
          .select('*', { count: 'exact', head: true })
          .eq('inspection_id', inspection.id);
        
        if (count === 0 && inspection.raw_violations) {
          // Parse and insert violations
          const violations = parseViolations(inspection.raw_violations);
          
          for (const viol of violations) {
            const { error: insertError } = await supabase
              .from('violations')
              .upsert({
                inspection_id: inspection.id,
                violation_code: viol.violation_code,
                violation_description: viol.violation_description,
                violation_comment: viol.violation_comment,
                is_critical: viol.is_critical,
              }, {
                onConflict: 'inspection_id,violation_code',
                ignoreDuplicates: true
              });
            
            if (!insertError) {
              totalViolationsAdded++;
            }
          }
          totalProcessed++;
          
          if (totalProcessed % 100 === 0) {
            console.log(`Processed ${totalProcessed} inspections, added ${totalViolationsAdded} violations`);
          }
        }
      }
      
      offset += batchSize;
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`\nBackfill complete!`);
    console.log(`Processed: ${totalProcessed} inspections`);
    console.log(`Added: ${totalViolationsAdded} violations`);
    return;
  }
  
  console.log(`Found ${inspections.length} inspections to backfill`);
}

backfillViolations().catch(console.error);

