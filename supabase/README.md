# Supabase Setup Instructions

## Prerequisites

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Install Supabase CLI (optional but recommended):
   ```bash
   npm install -g supabase
   ```

## Setup Steps

### 1. Run Migrations

If using Supabase CLI:
```bash
supabase db push
```

Or manually run the SQL files in the Supabase dashboard:
1. Go to SQL Editor in your Supabase dashboard
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/seed_neighborhoods.sql`

### 2. Set Environment Variables

Add these to your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Verify Setup

Check that:
- All tables are created
- RLS policies are enabled
- Indexes are created
- Functions are available

## Edge Functions

Edge Functions are in `supabase/functions/`. Deploy them using:
```bash
supabase functions deploy sync-inspections
```



