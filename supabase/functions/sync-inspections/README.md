# Sync Inspections Edge Function

This Edge Function syncs restaurant inspection data from the Chicago Data Portal API to Supabase.

## Deployment

```bash
supabase functions deploy sync-inspections
```

## Environment Variables

Set these in your Supabase dashboard:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for admin access)

## Scheduling

To run daily at 2 AM CST, set up a cron job in Supabase:

1. Go to Database > Cron Jobs
2. Create a new cron job:
   - Schedule: `0 2 * * *` (2 AM daily)
   - SQL: `SELECT net.http_post(url := 'https://your-project.supabase.co/functions/v1/sync-inspections', headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb);`

Or use Supabase's pg_cron extension if available.

## Manual Invocation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-inspections \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```







