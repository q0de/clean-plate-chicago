import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Test with ANON key only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  const inspectionId = '5b93c517-f231-4f29-8606-ada154a4fe10';
  
  console.log("🔍 Testing violations access with ANON key");
  console.log(`   Inspection ID: ${inspectionId}`);
  
  const { data, error, count } = await supabase
    .from('violations')
    .select('violation_code, inspection_id', { count: 'exact' })
    .eq('inspection_id', inspectionId);
  
  console.log(`\n📌 Results:`);
  console.log(`   Count: ${data?.length || 0}`);
  console.log(`   Exact count: ${count}`);
  console.log(`   Error: ${error?.message || 'none'}`);
  
  if (data && data.length > 0) {
    console.log(`   Data: ${JSON.stringify(data)}`);
  }
  
  // Also try total violations count
  const { count: totalCount } = await supabase
    .from('violations')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total violations in table: ${totalCount}`);
}

test();

