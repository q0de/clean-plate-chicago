# CleanPlate Chicago

A consumer-friendly web app for viewing Chicago restaurant health inspection data.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **UI:** HeroUI, Tailwind CSS
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Maps:** Mapbox GL JS
- **Language:** TypeScript

## Quick Start (Local Development)

### Option 1: Automated Setup (Windows PowerShell)
```powershell
.\setup-local.ps1
```

### Option 2: Manual Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
```bash
# Copy the example file
copy env.local.example .env.local
```

3. **Fill in your credentials in `.env.local`:**
   - Get Supabase credentials from https://supabase.com/dashboard
   - Get Mapbox token from https://account.mapbox.com/access-tokens/

4. **Set up Supabase database:**
   - Create a new Supabase project
   - Run the SQL migrations in Supabase dashboard:
     - `supabase/migrations/001_initial_schema.sql`
     - `supabase/seed_neighborhoods.sql`

5. **Run the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `app/` - Next.js App Router pages and layouts
- `components/` - Reusable React components
- `lib/` - Utility functions and Supabase client
- `supabase/` - Database migrations and Edge Functions

## Environment Variables

Required variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for Edge Functions)
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token
- `NEXT_PUBLIC_SITE_URL` - Site URL (default: http://localhost:3000)

## Documentation

- See `SETUP.md` for detailed setup instructions
- See `CleanPlate-Chicago-PRD-v2.md` for full product requirements

## License

MIT

