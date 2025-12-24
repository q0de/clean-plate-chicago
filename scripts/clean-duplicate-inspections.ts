/**
 * Script to find and remove duplicate inspections from the database.
 * Duplicates are identified by having the same inspection_id but different UUID ids.
 * This script keeps the oldest inspection (by created_at) and deletes the rest.
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

interface DuplicateGroup {
  inspection_id: string;
  ids: string[];
  establishment_id: string;
  inspection_date: string;
}

async function findDuplicateInspections(): Promise<DuplicateGroup[]> {
  console.log('🔍 Finding duplicate inspections...\n');

  // Get all inspections grouped by inspection_id
  const { data: allInspections, error: fetchError } = await supabase
    .from('inspections')
    .select('id, inspection_id, establishment_id, inspection_date, created_at')
    .order('created_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch inspections: ${fetchError.message}`);
  }

  if (!allInspections || allInspections.length === 0) {
    return [];
  }

  // Group by inspection_id
  const grouped = new Map<string, Array<{
    id: string;
    establishment_id: string;
    inspection_date: string;
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
      created_at: insp.created_at,
    });
  });

  // Find groups with more than one inspection
  const duplicates: DuplicateGroup[] = [];
  grouped.forEach((inspections, inspection_id) => {
    if (inspections.length > 1) {
      // Sort by created_at to keep the oldest
      const sorted = [...inspections].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      duplicates.push({
        inspection_id,
        ids: sorted.map(i => i.id),
        establishment_id: sorted[0].establishment_id,
        inspection_date: sorted[0].inspection_date,
      });
    }
  });

  return duplicates;
}

async function deleteDuplicateInspections(duplicates: DuplicateGroup[], dryRun: boolean = true): Promise<void> {
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '🗑️  DELETING'} duplicate inspections...\n`);

  let totalDuplicates = 0;
  let totalToDelete = 0;
  const deletionErrors: Array<{ inspection_id: string; error: string }> = [];

  for (const group of duplicates) {
    totalDuplicates += group.ids.length;
    // Keep the first (oldest), delete the rest
    const toDelete = group.ids.slice(1);
    totalToDelete += toDelete.length;

    console.log(`Inspection ID: ${group.inspection_id}`);
    console.log(`  Date: ${group.inspection_date}`);
    console.log(`  Total duplicates: ${group.ids.length}`);
    console.log(`  Keeping: ${group.ids[0]} (oldest)`);
    console.log(`  ${dryRun ? 'Would delete' : 'Deleting'}: ${toDelete.length} duplicate(s)`);

    if (!dryRun) {
      // Delete violations first (CASCADE should handle this, but being explicit)
      for (const id of toDelete) {
        const { error: violError } = await supabase
          .from('violations')
          .delete()
          .eq('inspection_id', id);

        if (violError) {
          console.error(`    ⚠️  Error deleting violations for ${id}: ${violError.message}`);
          deletionErrors.push({ inspection_id: group.inspection_id, error: violError.message });
        }
      }

      // Delete duplicate inspections
      const { error: deleteError } = await supabase
        .from('inspections')
        .delete()
        .in('id', toDelete);

      if (deleteError) {
        console.error(`    ❌ Error deleting inspections: ${deleteError.message}`);
        deletionErrors.push({ inspection_id: group.inspection_id, error: deleteError.message });
      } else {
        console.log(`    ✅ Successfully deleted ${toDelete.length} duplicate(s)`);
      }
    }

    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(`Total duplicate groups: ${duplicates.length}`);
  console.log(`Total duplicate inspection records: ${totalDuplicates}`);
  console.log(`Records to ${dryRun ? 'delete' : 'deleted'}: ${totalToDelete}`);
  console.log(`Records to keep: ${duplicates.length}`);

  if (deletionErrors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${deletionErrors.length}`);
    deletionErrors.forEach(err => {
      console.log(`  - ${err.inspection_id}: ${err.error}`);
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  try {
    if (dryRun) {
      console.log('🧪 Running in DRY RUN mode. Use --execute to actually delete duplicates.\n');
    } else {
      console.log('⚠️  EXECUTE mode: This will delete duplicate inspections from the database!\n');
    }

    const duplicates = await findDuplicateInspections();

    if (duplicates.length === 0) {
      console.log('✅ No duplicate inspections found. Database is clean!');
      return;
    }

    console.log(`\nFound ${duplicates.length} groups of duplicate inspections.\n`);

    await deleteDuplicateInspections(duplicates, dryRun);

    if (dryRun) {
      console.log('\n💡 To actually delete these duplicates, run:');
      console.log('   npx tsx scripts/clean-duplicate-inspections.ts --execute');
      console.log('   or');
      console.log('   npm run clean-duplicates -- --execute');
    } else {
      console.log('\n✅ Cleanup complete!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

