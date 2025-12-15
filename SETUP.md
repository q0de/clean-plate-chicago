# Local Development Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- A Supabase account (free tier works)
- A Mapbox account (free tier works)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase

1. Create a new project at https://supabase.com
2. Go to Project Settings > API to get your credentials
3. Run the database migrations:
   - Go to SQL Editor in Supabase dashboard
   - Run `supabase/migrations/001_initial_schema.sql`
   - Run `supabase/seed_neighborhoods.sql`

## Step 3: Configure Environment Variables

1. Copy `.env.local` and fill in your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL` - From Supabase dashboard
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase dashboard
   - `SUPABASE_SERVICE_ROLE_KEY` - From Supabase dashboard (keep secret!)
   - `NEXT_PUBLIC_MAPBOX_TOKEN` - From Mapbox account

## Step 4: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 5: (Optional) Set Up Data Sync

To sync data from Chicago API:

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy sync-inspections
   ```

2. Or manually trigger it from Supabase dashboard > Edge Functions

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists and has all required variables
- Restart the dev server after adding environment variables

### Map not loading
- Check that `NEXT_PUBLIC_MAPBOX_TOKEN` is set correctly
- Verify the token is active in Mapbox dashboard

### Database errors
- Make sure you've run the migrations
- Check that PostGIS extension is enabled in Supabase

### TypeScript errors
- Run `npm install` again
- Delete `.next` folder and restart dev server



