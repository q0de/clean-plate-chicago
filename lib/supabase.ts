import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Custom fetch that disables Next.js caching to ensure fresh data
const customFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
  return fetch(url, { ...options, cache: 'no-store' });
};

// Create client even if env vars are empty (for build time)
// Will fail at runtime if actually used without proper env vars
let supabase: SupabaseClient

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: customFetch,
    },
  })
} else {
  // Create a dummy client for build time - will be replaced at runtime
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    global: {
      fetch: customFetch,
    },
  })
}

export { supabase }
