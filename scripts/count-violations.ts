import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function count() {
  const { count } = await supabase.from('violations').select('*', { count: 'exact', head: true });
  console.log('Total violations in database:', count);
  
  // Count unique inspection_ids
  const { data } = await supabase.from('violations').select('inspection_id');
  const uniqueIds = new Set(data?.map(v => v.inspection_id));
  console.log('Unique inspection_ids with violations:', uniqueIds.size);
}

count();

