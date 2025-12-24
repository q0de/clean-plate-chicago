/**
 * Script to recalculate CleanPlate Scores for all establishments
 * 
 * Algorithm v2.0:
 * Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
 * 
 * Run with: node scripts/recalculate-all-scores.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// CleanPlate Score Calculator v2.0
// ============================================================================

/**
 * Get risk-adjusted half-life in months for time decay
 */
function getRiskAdjustedHalfLife(riskLevel) {
  switch (riskLevel) {
    case 1: return 6;   // Risk 1: inspected every 6 months
    case 2: return 12;  // Risk 2: inspected every 12 months
    case 3: return 24;  // Risk 3: inspected every 24 months
    default: return 12;
  }
}

/**
 * Get expected inspection interval in days for a risk level
 */
function getExpectedIntervalDays(riskLevel) {
  switch (riskLevel) {
    case 1: return 180;  // 6 months
    case 2: return 365;  // 12 months
    case 3: return 730;  // 24 months
    default: return 365;
  }
}

/**
 * Calculate time decay weight for an inspection
 */
function calculateTimeWeight(monthsSinceInspection, riskLevel) {
  const halfLife = getRiskAdjustedHalfLife(riskLevel);
  const lambda = 0.693 / halfLife;
  return Math.exp(-lambda * monthsSinceInspection);
}

/**
 * Calculate risk-adjusted recency score
 */
function calculateRecencyScore(daysSinceInspection, riskLevel) {
  const expectedInterval = getExpectedIntervalDays(riskLevel);
  const ratio = daysSinceInspection / expectedInterval;
  
  if (ratio < 0.5) return 100;   // Very recent
  if (ratio <= 1.0) return 85;   // On schedule
  if (ratio <= 1.25) return 60;  // Slightly overdue
  return 40;                      // Overdue
}

/**
 * Get outcome points for an inspection result
 */
function getOutcomePoints(results) {
  const resultLower = results.toLowerCase();
  if (resultLower.includes("pass") && !resultLower.includes("condition") && !resultLower.includes("fail")) {
    return 100;
  } else if (resultLower.includes("condition")) {
    return 70;
  } else if (resultLower.includes("fail")) {
    return 30;
  }
  return 50;
}

/**
 * Calculate months since a given date
 */
function getMonthsSinceDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  const dayDiff = now.getDate() - date.getDate();
  return months + (dayDiff / 30);
}

/**
 * Calculate days since a given date
 */
function getDaysSinceInspection(dateStr) {
  const inspectionDate = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate the Result component (35%) - Time-weighted average of outcomes
 */
function calculateResultScore(inspections, riskLevel) {
  if (inspections.length === 0) return 50;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const insp of inspections) {
    const monthsSince = getMonthsSinceDate(insp.inspection_date);
    const weight = calculateTimeWeight(monthsSince, riskLevel);
    const points = getOutcomePoints(insp.results);
    
    weightedSum += points * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

/**
 * Calculate the Violations component (25%)
 */
function calculateViolationsScore(latest) {
  const criticalPenalty = latest.critical_count * 15;
  const nonCriticalPenalty = (latest.violation_count - latest.critical_count) * 5;
  return Math.max(0, 100 - criticalPenalty - nonCriticalPenalty);
}

/**
 * Calculate the Trend component (15%)
 */
function calculateTrendScore(inspections) {
  if (inspections.length < 3) return 60; // Default to neutral

  const scores = inspections.slice(0, 4).map(insp => getOutcomePoints(insp.results));
  
  if (scores.length < 3) return 60;

  const recentAvg = (scores[0] + scores[1]) / 2;
  const previousAvg = scores.length >= 4 
    ? (scores[2] + scores[3]) / 2 
    : scores[2];
  
  const trendDelta = recentAvg - previousAvg;

  if (trendDelta >= 30) return 100;       // Strong improvement
  if (trendDelta >= 15) return 85;        // Moderate improvement
  if (trendDelta >= 1) return 70;         // Slight improvement
  if (trendDelta >= -1) return 60;        // Stable
  if (trendDelta >= -14) return 45;       // Slight decline
  if (trendDelta >= -29) return 30;       // Moderate decline
  return 15;                               // Strong decline
}

/**
 * Calculate the Track Record component (15%)
 */
function calculateTrackRecordScore(inspections) {
  let penaltyPoints = 0;
  const now = new Date();

  for (const insp of inspections) {
    const inspDate = new Date(insp.inspection_date);
    const monthsAgo = (now.getFullYear() - inspDate.getFullYear()) * 12 + 
                      (now.getMonth() - inspDate.getMonth());
    
    const resultLower = insp.results.toLowerCase();

    // Fail result: +2 penalty, 36 month lookback
    if (resultLower.includes("fail") && monthsAgo <= 36) {
      penaltyPoints += 2;
    }

    // Critical violations: +3 penalty per inspection with criticals, 36 month lookback
    if (insp.critical_count > 0 && monthsAgo <= 36) {
      penaltyPoints += 3;
    }
  }

  const cappedPenalty = Math.min(penaltyPoints, 20);
  return Math.max(0, 100 - (cappedPenalty * 5));
}

/**
 * Calculate pass streak
 */
function getPassStreak(inspections) {
  let streak = 0;
  for (const insp of inspections) {
    const r = insp.results.toLowerCase();
    if (r.includes("pass") && !r.includes("condition") && !r.includes("fail")) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Calculate CleanPlate Score using v2.0 algorithm
 */
function calculateCleanPlateScore(latest, inspections, riskLevel) {
  const daysSince = getDaysSinceInspection(latest.inspection_date);

  // Calculate all components
  const resultScore = calculateResultScore(inspections, riskLevel);
  const violationsScore = calculateViolationsScore(latest);
  const trendScore = calculateTrendScore(inspections);
  const trackRecordScore = calculateTrackRecordScore(inspections);
  const recencyScore = calculateRecencyScore(daysSince, riskLevel);

  // Apply weights: 35/25/15/15/10
  let score = 
    resultScore * 0.35 +
    violationsScore * 0.25 +
    trendScore * 0.15 +
    trackRecordScore * 0.15 +
    recencyScore * 0.10;

  // Apply modifiers
  const passStreak = getPassStreak(inspections);
  if (passStreak >= 3) {
    score += 5; // Bonus for 3+ consecutive passes
  }

  // Penalty for recent failure (within 90 days)
  const hasRecentFailure = inspections.some(
    (insp) =>
      insp.results.toLowerCase().includes("fail") &&
      getDaysSinceInspection(insp.inspection_date) <= 90
  );
  if (hasRecentFailure) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============================================================================
// Main Script
// ============================================================================

async function recalculateAllScores() {
  console.log("CleanPlate Score Recalculation Script v2.0");
  console.log("Algorithm: Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)");
  console.log("Features: Risk-adjusted time decay, risk-adjusted recency\n");
  
  console.log("Fetching all establishments...");

  // Fetch all establishments using pagination (Supabase default limit is 1000)
  const establishments = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from("establishments")
      .select("id, slug, risk_level, cleanplate_score")
      .order("dba_name")
      .range(from, from + batchSize - 1);

    if (error) {
      console.error("Error fetching establishments:", error);
      return;
    }

    if (!batch || batch.length === 0) break;

    establishments.push(...batch);
    console.log(`Fetched batch: ${batch.length} establishments (total: ${establishments.length})`);

    if (batch.length < batchSize) break;
    from += batchSize;
  }

  console.log(`Found ${establishments.length} establishments to process\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const est of establishments) {
    try {
      // Fetch recent inspections (get more for track record calculation)
      const { data: inspections } = await supabase
        .from("inspections")
        .select("results, inspection_date, violation_count, critical_count")
        .eq("establishment_id", est.id)
        .order("inspection_date", { ascending: false })
        .limit(10);

      if (!inspections || inspections.length === 0) {
        skipped++;
        continue;
      }

      const latest = inspections[0];
      const riskLevel = est.risk_level || 2;

      // Calculate new score
      const newScore = calculateCleanPlateScore(latest, inspections, riskLevel);

      // Calculate pass streak
      const passStreak = getPassStreak(inspections);

      // Only update if score changed
      if (newScore !== est.cleanplate_score) {
        await supabase
          .from("establishments")
          .update({
            cleanplate_score: newScore,
            pass_streak: passStreak,
            latest_result: latest.results,
            latest_inspection_date: latest.inspection_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", est.id);

        console.log(`${est.slug}: ${est.cleanplate_score ?? 'null'} -> ${newScore} (Risk ${riskLevel})`);
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Error processing ${est.slug}:`, err.message);
      errors++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("Done!");
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no change): ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

recalculateAllScores().catch(console.error);
