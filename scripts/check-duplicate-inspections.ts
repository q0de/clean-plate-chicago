/**
 * Script to check for duplicate inspections in the database.
 * This helps identify if duplicates exist and what's causing them.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate inspections in database...\n');

  // Query to find duplicate inspection_id values
  // Using a raw SQL query to group and count
  const { data: duplicates, error } = await supabase.rpc('find_inspection_duplicates');

  if (error && error.message.includes('function')) {
    // If the RPC doesn't exist, use a query-based approach
    console.log('Using query-based approach to find duplicates...\n');
    
    // Get all inspections
    const { data: allInspections, error: fetchError } = await supabase
      .from('inspections')
      .select('id, inspection_id, establishment_id, inspection_date, inspection_type, results, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch inspections: ${fetchError.message}`);
    }

    if (!allInspections || allInspections.length === 0) {
      console.log('✅ No inspections found in database.');
      return;
    }

    console.log(`📊 Total inspections in database: ${allInspections.length}\n`);

    // Group by inspection_id
    const grouped = new Map<string, Array<{
      id: string;
      establishment_id: string;
      inspection_date: string;
      inspection_type: string;
      results: string;
      created_at: string;
    }>>();

    allInspections.forEach((insp) => {
      if (!grouped.has(insp.inspection_id)) {
        grouped.set(insp.inspection_id, []);
      }
      grouped.get(insp.inspection_id)!.push({
        id: insp.id,
        establishment_id: insp.establishment_id,
        inspection_date: insp.inspection_date,
        inspection_type: insp.inspection_type,
        results: insp.results,
        created_at: insp.created_at,
      });
    });

    // Find groups with more than one inspection
    const duplicateGroups: Array<{
      inspection_id: string;
      count: number;
      ids: string[];
      details: any[];
    }> = [];

    grouped.forEach((inspections, inspection_id) => {
      if (inspections.length > 1) {
        duplicateGroups.push({
          inspection_id,
          count: inspections.length,
          ids: inspections.map(i => i.id),
          details: inspections,
        });
      }
    });

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate inspections found! Database is clean.');
      console.log(`   Unique inspection_ids: ${grouped.size}`);
      return;
    }

    console.log(`❌ Found ${duplicateGroups.length} duplicate inspection_id groups:\n`);

    // Show details of duplicates
    for (const group of duplicateGroups.slice(0, 10)) { // Show first 10
      console.log(`Inspection ID: ${group.inspection_id}`);
      console.log(`  Count: ${group.count} duplicates`);
      console.log(`  Establishment IDs: ${[...new Set(group.details.map(d => d.establishment_id))].join(', ')}`);
      group.details.forEach((detail, idx) => {
        console.log(`  [${idx + 1}] UUID: ${detail.id}`);
        console.log(`      Date: ${detail.inspection_date}, Type: ${detail.inspection_type}, Result: ${detail.results}`);
        console.log(`      Created: ${detail.created_at}`);
      });
      console.log('');
    }

    if (duplicateGroups.length > 10) {
      console.log(`... and ${duplicateGroups.length - 10} more duplicate groups\n`);
    }

    // Summary statistics
    const totalDuplicateRecords = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
    const uniqueDuplicateIds = duplicateGroups.length;
    const recordsToDelete = totalDuplicateRecords - uniqueDuplicateIds;

    console.log('\n=== Summary ===');
    console.log(`Total duplicate groups: ${uniqueDuplicateIds}`);
    console.log(`Total duplicate inspection records: ${totalDuplicateRecords}`);
    console.log(`Records that should be deleted: ${recordsToDelete}`);
    console.log(`Records to keep: ${uniqueDuplicateIds}`);
    console.log(`\n💡 Run the cleanup script to remove duplicates:`);
    console.log(`   npm run clean-duplicates -- --execute`);

    // Check if the unique constraint is actually enforced
    console.log('\n🔍 Checking database constraint status...');
    const { data: constraintInfo, error: constraintError } = await supabase
      .from('inspections')
      .select('inspection_id')
      .limit(1);

    if (constraintError) {
      console.log(`⚠️  Could not verify constraint: ${constraintError.message}`);
    } else {
      console.log('✅ Can query inspections table');
      console.log('⚠️  Note: If duplicates exist, the UNIQUE constraint may not be properly enforced.');
      console.log('   This could happen if:');
      console.log('   1. The constraint was added after duplicates were inserted');
      console.log('   2. There was a migration issue');
      console.log('   3. Data was inserted with bypassing constraints');
    }
  } else if (error) {
    throw new Error(`Error checking duplicates: ${error.message}`);
  } else {
    // RPC function exists and returned data
    console.log('Duplicates found:', duplicates);
  }
}

async function main() {
  try {
    await checkDuplicates();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

