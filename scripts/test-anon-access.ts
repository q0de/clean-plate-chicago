import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Test with ANON key (what the API uses)
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Test with SERVICE key (what our scripts use)
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  const inspectionId = '5b93c517-f231-4f29-8606-ada154a4fe10';
  
  console.log("🔍 Testing violations access for inspection:", inspectionId);
  
  // Test with anon key
  const { data: anonData, error: anonError } = await anonClient
    .from('violations')
    .select('violation_code')
    .eq('inspection_id', inspectionId);
  
  console.log(`\n📌 ANON key results:`);
  console.log(`   Count: ${anonData?.length || 0}`);
  console.log(`   Error: ${anonError?.message || 'none'}`);
  
  // Test with service key
  const { data: serviceData, error: serviceError } = await serviceClient
    .from('violations')
    .select('violation_code')
    .eq('inspection_id', inspectionId);
  
  console.log(`\n📌 SERVICE key results:`);
  console.log(`   Count: ${serviceData?.length || 0}`);
  console.log(`   Error: ${serviceError?.message || 'none'}`);
  if (serviceData) {
    console.log(`   Codes: ${serviceData.map(v => v.violation_code).join(', ')}`);
  }
}

test();

