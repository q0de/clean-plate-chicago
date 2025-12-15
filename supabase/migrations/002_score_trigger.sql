-- Migration: Add automatic CleanPlate Score recalculation trigger
-- This trigger fires after each inspection insert and recalculates the establishment's score

-- Function: Calculate CleanPlate Score for an establishment
-- Formula: Score = (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)
CREATE OR REPLACE FUNCTION calculate_cleanplate_score(
  p_establishment_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_latest RECORD;
  v_risk_level INTEGER;
  v_result_score INTEGER := 50;
  v_trend_score INTEGER := 0;
  v_violations_score INTEGER := 100;
  v_recency_score INTEGER := 20;
  v_risk_score INTEGER := 80;
  v_days_since INTEGER;
  v_pass_streak INTEGER := 0;
  v_has_recent_failure BOOLEAN := FALSE;
  v_score NUMERIC;
  v_insp RECORD;
  v_prev_scores INTEGER[] := ARRAY[]::INTEGER[];
  v_count INTEGER := 0;
BEGIN
  -- Get establishment risk level
  SELECT risk_level INTO v_risk_level
  FROM establishments
  WHERE id = p_establishment_id;
  
  IF v_risk_level IS NULL THEN
    v_risk_level := 2; -- Default to medium risk
  END IF;

  -- Get recent inspections (up to 5, ordered by date descending)
  FOR v_insp IN
    SELECT results, inspection_date, violation_count, critical_count
    FROM inspections
    WHERE establishment_id = p_establishment_id
    ORDER BY inspection_date DESC
    LIMIT 5
  LOOP
    v_count := v_count + 1;
    
    -- First inspection is the latest
    IF v_count = 1 THEN
      v_latest := v_insp;
      
      -- Calculate Result component (40%)
      IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%condition%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
        v_result_score := 100;
      ELSIF LOWER(v_insp.results) LIKE '%condition%' THEN
        v_result_score := 70;
      ELSIF LOWER(v_insp.results) LIKE '%fail%' THEN
        v_result_score := 30;
      END IF;
      
      -- Calculate Violations component (20%)
      v_violations_score := GREATEST(0, 100 - (COALESCE(v_insp.critical_count, 0) * 15) - ((COALESCE(v_insp.violation_count, 0) - COALESCE(v_insp.critical_count, 0)) * 5));
      
      -- Calculate Recency component (10%) - use date subtraction which returns integer days
      v_days_since := CURRENT_DATE - v_insp.inspection_date::DATE;
      IF v_days_since < 180 THEN
        v_recency_score := 100;
      ELSIF v_days_since < 365 THEN
        v_recency_score := 80;
      ELSIF v_days_since < 540 THEN
        v_recency_score := 50;
      ELSE
        v_recency_score := 20;
      END IF;
    END IF;
    
    -- Track scores for trend calculation
    IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%condition%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
      v_prev_scores := array_append(v_prev_scores, 100);
    ELSIF LOWER(v_insp.results) LIKE '%condition%' THEN
      v_prev_scores := array_append(v_prev_scores, 70);
    ELSIF LOWER(v_insp.results) LIKE '%fail%' THEN
      v_prev_scores := array_append(v_prev_scores, 30);
    ELSE
      v_prev_scores := array_append(v_prev_scores, 50);
    END IF;
    
    -- Calculate pass streak
    IF v_count <= 5 THEN
      IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
        IF v_pass_streak = v_count - 1 THEN
          v_pass_streak := v_count;
        END IF;
      END IF;
    END IF;
    
    -- Check for recent failure (within 90 days)
    IF LOWER(v_insp.results) LIKE '%fail%' AND (CURRENT_DATE - v_insp.inspection_date::DATE) <= 90 THEN
      v_has_recent_failure := TRUE;
    END IF;
  END LOOP;
  
  -- If no inspections found, return NULL
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate Trend component (20%) - need at least 3 inspections
  IF array_length(v_prev_scores, 1) >= 3 THEN
    -- v_prev_scores[1] is most recent, v_prev_scores[3] is oldest of last 3
    IF v_prev_scores[1] > v_prev_scores[2] AND v_prev_scores[2] > v_prev_scores[3] THEN
      v_trend_score := 10; -- Improving
    ELSIF v_prev_scores[1] < v_prev_scores[2] AND v_prev_scores[2] < v_prev_scores[3] THEN
      v_trend_score := -10; -- Declining
    END IF;
  END IF;
  
  -- Calculate Risk component (10%)
  IF v_risk_level = 3 THEN
    v_risk_score := 100;
  ELSIF v_risk_level = 2 THEN
    v_risk_score := 80;
  ELSIF v_risk_level = 1 THEN
    v_risk_score := 60;
  END IF;
  
  -- Calculate base score using PRD formula
  v_score := (v_result_score * 0.40) + 
             (v_trend_score * 0.20) + 
             (v_violations_score * 0.20) + 
             (v_recency_score * 0.10) + 
             (v_risk_score * 0.10);
  
  -- Apply modifiers
  IF v_pass_streak >= 3 THEN
    v_score := v_score + 5;
  END IF;
  
  IF v_days_since > 540 THEN
    v_score := v_score - 20;
  END IF;
  
  IF v_has_recent_failure THEN
    v_score := v_score - 10;
  END IF;
  
  -- Clamp to 0-100
  RETURN LEAST(100, GREATEST(0, ROUND(v_score)));
END;
$$ LANGUAGE plpgsql;

-- Function: Trigger function to recalculate score on inspection insert
CREATE OR REPLACE FUNCTION trigger_recalculate_score()
RETURNS TRIGGER AS $$
DECLARE
  v_new_score INTEGER;
  v_pass_streak INTEGER := 0;
  v_latest_result TEXT;
  v_latest_date DATE;
  v_insp RECORD;
BEGIN
  -- Calculate new score
  v_new_score := calculate_cleanplate_score(NEW.establishment_id);
  
  -- Calculate pass streak
  FOR v_insp IN
    SELECT results, inspection_date
    FROM inspections
    WHERE establishment_id = NEW.establishment_id
    ORDER BY inspection_date DESC
    LIMIT 5
  LOOP
    IF v_latest_result IS NULL THEN
      v_latest_result := v_insp.results;
      v_latest_date := v_insp.inspection_date;
    END IF;
    
    IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
      v_pass_streak := v_pass_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  
  -- Update establishment with new score and metadata
  UPDATE establishments
  SET 
    cleanplate_score = v_new_score,
    pass_streak = v_pass_streak,
    latest_result = v_latest_result,
    latest_inspection_date = v_latest_date,
    updated_at = NOW()
  WHERE id = NEW.establishment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on inspections table
DROP TRIGGER IF EXISTS recalculate_score_on_inspection ON inspections;
CREATE TRIGGER recalculate_score_on_inspection
  AFTER INSERT ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_score();

-- Add comment for documentation
COMMENT ON FUNCTION calculate_cleanplate_score(UUID) IS 
  'Calculates CleanPlate Score using formula: (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10) with modifiers for pass streak, stale inspections, and recent failures.';

COMMENT ON TRIGGER recalculate_score_on_inspection ON inspections IS
  'Automatically recalculates establishment CleanPlate Score when a new inspection is inserted.';

