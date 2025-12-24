-- Migration: Remove plain_english column from violations table
-- This field is no longer used - InspectionTimeline uses violation_description instead
-- AI summary generation doesn't use it either

ALTER TABLE violations 
DROP COLUMN IF EXISTS plain_english;

