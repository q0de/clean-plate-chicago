-- Add external_data JSONB column to cache Yelp/Google business info
-- This stores: { image_url, phone, categories, tagline, yelp_url, fetched_at }

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS external_data JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN establishments.external_data IS 'Cached external business data from Yelp/Google: { image_url, phone, categories, tagline, yelp_url, fetched_at }';

-- Create index for faster lookups on fetched_at for stale-while-revalidate
CREATE INDEX IF NOT EXISTS idx_establishments_external_data_fetched 
ON establishments ((external_data->>'fetched_at'));

