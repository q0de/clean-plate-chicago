-- Migration: Update CleanPlate Score trigger to v2.0 formula
-- Formula: Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)

-- Drop old function and trigger
DROP TRIGGER IF EXISTS recalculate_score_on_inspection ON inspections;
DROP FUNCTION IF EXISTS trigger_recalculate_score();
DROP FUNCTION IF EXISTS calculate_cleanplate_score(UUID);

-- Function: Calculate CleanPlate Score for an establishment (v2.0)
CREATE OR REPLACE FUNCTION calculate_cleanplate_score(
  p_establishment_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_latest RECORD;
  v_risk_level INTEGER;
  v_result_score NUMERIC := 50;
  v_violations_score NUMERIC := 100;
  v_trend_score NUMERIC := 60;
  v_track_record_score NUMERIC := 100;
  v_recency_score NUMERIC := 40;
  v_days_since INTEGER;
  v_months_since NUMERIC;
  v_pass_streak INTEGER := 0;
  v_has_recent_failure BOOLEAN := FALSE;
  v_score NUMERIC;
  v_insp RECORD;
  v_count INTEGER := 0;
  v_half_life NUMERIC;
  v_lambda NUMERIC;
  v_expected_interval_days INTEGER;
  v_ratio NUMERIC;
  v_weighted_sum NUMERIC := 0;
  v_total_weight NUMERIC := 0;
  v_weight NUMERIC;
  v_points NUMERIC;
  v_months_ago INTEGER;
  v_penalty_points INTEGER := 0;
  v_recent_scores NUMERIC[] := ARRAY[]::NUMERIC[];
  v_recent_avg NUMERIC;
  v_previous_avg NUMERIC;
  v_trend_delta NUMERIC;
  v_insp_count INTEGER;
BEGIN
  -- Get establishment risk level
  SELECT risk_level INTO v_risk_level
  FROM establishments
  WHERE id = p_establishment_id;
  
  IF v_risk_level IS NULL THEN
    v_risk_level := 2; -- Default to medium risk
  END IF;

  -- Get risk-adjusted half-life and expected interval
  CASE v_risk_level
    WHEN 1 THEN 
      v_half_life := 6;   -- 6 months
      v_expected_interval_days := 180;
    WHEN 3 THEN 
      v_half_life := 24;   -- 24 months
      v_expected_interval_days := 730;
    ELSE 
      v_half_life := 12;   -- 12 months
      v_expected_interval_days := 365;
  END CASE;
  
  v_lambda := 0.693 / v_half_life;

  -- Get latest inspection
  SELECT results, inspection_date, violation_count, critical_count
  INTO v_latest
  FROM inspections
  WHERE establishment_id = p_establishment_id
  ORDER BY inspection_date DESC
  LIMIT 1;
  
  IF v_latest IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate days since latest inspection
  v_days_since := CURRENT_DATE - v_latest.inspection_date::DATE;
  
  -- Calculate Violations component (25%)
  v_violations_score := GREATEST(0, 100 - (COALESCE(v_latest.critical_count, 0) * 15) - 
    ((COALESCE(v_latest.violation_count, 0) - COALESCE(v_latest.critical_count, 0)) * 5));
  
  -- Calculate Recency component (10%) - risk-adjusted
  v_ratio := v_days_since::NUMERIC / v_expected_interval_days;
  IF v_ratio < 0.5 THEN
    v_recency_score := 100;   -- Very recent
  ELSIF v_ratio <= 1.0 THEN
    v_recency_score := 85;    -- On schedule
  ELSIF v_ratio <= 1.25 THEN
    v_recency_score := 60;    -- Slightly overdue
  ELSE
    v_recency_score := 40;    -- Overdue
  END IF;
  
  -- Check for recent failure (within 90 days) for modifier
  IF LOWER(v_latest.results) LIKE '%fail%' AND v_days_since <= 90 THEN
    v_has_recent_failure := TRUE;
  END IF;
  
  -- Calculate Result component (35%) - Time-weighted average using exponential decay
  FOR v_insp IN
    SELECT results, inspection_date, violation_count, critical_count
    FROM inspections
    WHERE establishment_id = p_establishment_id
    ORDER BY inspection_date DESC
    LIMIT 10
  LOOP
    v_count := v_count + 1;
    
    -- Calculate months since inspection
    v_months_since := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_insp.inspection_date)) * 12 + 
                      EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_insp.inspection_date)) +
                      EXTRACT(DAY FROM AGE(CURRENT_DATE, v_insp.inspection_date)) / 30.0;
    
    -- Calculate time decay weight
    v_weight := EXP(-v_lambda * v_months_since);
    
    -- Get outcome points
    IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%condition%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
      v_points := 100;
    ELSIF LOWER(v_insp.results) LIKE '%condition%' THEN
      v_points := 70;
    ELSIF LOWER(v_insp.results) LIKE '%fail%' THEN
      v_points := 30;
    ELSE
      v_points := 50;
    END IF;
    
    v_weighted_sum := v_weighted_sum + (v_points * v_weight);
    v_total_weight := v_total_weight + v_weight;
    
    -- Calculate pass streak (first 5 inspections)
    IF v_count <= 5 THEN
      IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%condition%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
        IF v_pass_streak = v_count - 1 THEN
          v_pass_streak := v_count;
        END IF;
      END IF;
    END IF;
    
    -- Collect scores for trend calculation (first 4)
    IF v_count <= 4 THEN
      v_recent_scores := array_append(v_recent_scores, v_points);
    END IF;
    
    -- Calculate Track Record penalties (all inspections in last 36 months)
    v_months_ago := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_insp.inspection_date)) * 12 + 
                    EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_insp.inspection_date));
    
    IF v_months_ago <= 36 THEN
      -- Fail result: +2 penalty
      IF LOWER(v_insp.results) LIKE '%fail%' THEN
        v_penalty_points := v_penalty_points + 2;
      END IF;
      
      -- Critical violations: +3 penalty per inspection with criticals
      IF COALESCE(v_insp.critical_count, 0) > 0 THEN
        v_penalty_points := v_penalty_points + 3;
      END IF;
    END IF;
  END LOOP;
  
  -- Calculate Result score from weighted average
  IF v_total_weight > 0 THEN
    v_result_score := v_weighted_sum / v_total_weight;
  END IF;
  
  -- Calculate Trend component (15%) - Compare recent 2 vs previous 2
  IF array_length(v_recent_scores, 1) >= 3 THEN
    v_recent_avg := (v_recent_scores[1] + v_recent_scores[2]) / 2.0;
    IF array_length(v_recent_scores, 1) >= 4 THEN
      v_previous_avg := (v_recent_scores[3] + v_recent_scores[4]) / 2.0;
    ELSE
      v_previous_avg := v_recent_scores[3];
    END IF;
    
    v_trend_delta := v_recent_avg - v_previous_avg;
    
    -- Map trend delta to score
    IF v_trend_delta >= 30 THEN
      v_trend_score := 100;       -- Strong improvement
    ELSIF v_trend_delta >= 15 THEN
      v_trend_score := 85;        -- Moderate improvement
    ELSIF v_trend_delta >= 1 THEN
      v_trend_score := 70;         -- Slight improvement
    ELSIF v_trend_delta >= -1 THEN
      v_trend_score := 60;        -- Stable
    ELSIF v_trend_delta >= -14 THEN
      v_trend_score := 45;        -- Slight decline
    ELSIF v_trend_delta >= -29 THEN
      v_trend_score := 30;        -- Moderate decline
    ELSE
      v_trend_score := 15;        -- Strong decline
    END IF;
  END IF;
  
  -- Calculate Track Record component (15%) - Cap penalty at 20 points
  v_penalty_points := LEAST(v_penalty_points, 20);
  v_track_record_score := GREATEST(0, 100 - (v_penalty_points * 5));
  
  -- Calculate base score using v2.0 formula
  v_score := (v_result_score * 0.35) + 
             (v_violations_score * 0.25) + 
             (v_trend_score * 0.15) + 
             (v_track_record_score * 0.15) + 
             (v_recency_score * 0.10);
  
  -- Apply modifiers
  IF v_pass_streak >= 3 THEN
    v_score := v_score + 5; -- Bonus for 3+ consecutive passes
  END IF;
  
  IF v_has_recent_failure THEN
    v_score := v_score - 10; -- Penalty for recent failure (within 90 days)
  END IF;
  
  -- Clamp to 0-100
  RETURN LEAST(100, GREATEST(0, ROUND(v_score)));
END;
$$ LANGUAGE plpgsql;

-- Function: Trigger function to recalculate score on inspection insert/update
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
    
    IF LOWER(v_insp.results) LIKE '%pass%' AND LOWER(v_insp.results) NOT LIKE '%condition%' AND LOWER(v_insp.results) NOT LIKE '%fail%' THEN
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

-- Create the trigger on inspections table (fires on both INSERT and UPDATE)
DROP TRIGGER IF EXISTS recalculate_score_on_inspection ON inspections;
CREATE TRIGGER recalculate_score_on_inspection
  AFTER INSERT OR UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_score();

-- Add comment for documentation
COMMENT ON FUNCTION calculate_cleanplate_score(UUID) IS 
  'Calculates CleanPlate Score using v2.0 formula: (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10) with modifiers for pass streak and recent failures.';

COMMENT ON TRIGGER recalculate_score_on_inspection ON inspections IS
  'Automatically recalculates establishment CleanPlate Score when a new inspection is inserted or updated.';
