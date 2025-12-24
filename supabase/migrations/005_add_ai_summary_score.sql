-- Migration: Add ai_summary_score column to track which score was used when generating summaries
-- This allows us to invalidate cached summaries when the CleanPlate score changes

ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS ai_summary_score INTEGER;

COMMENT ON COLUMN establishments.ai_summary_score IS 
  'The CleanPlate score that was used when generating ai_summary. Used to invalidate cache when score changes.';

