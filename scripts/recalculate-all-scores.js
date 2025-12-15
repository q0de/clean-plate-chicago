/**
 * Script to recalculate CleanPlate Scores for all establishments
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

async function recalculateAllScores() {
  console.log("Fetching all establishments...");

  const { data: establishments, error } = await supabase
    .from("establishments")
    .select("id, slug, risk_level, cleanplate_score")
    .order("dba_name");

  if (error) {
    console.error("Error fetching establishments:", error);
    return;
  }

  console.log(`Found ${establishments.length} establishments to process`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const est of establishments) {
    try {
      // Fetch recent inspections
      const { data: inspections } = await supabase
        .from("inspections")
        .select("results, inspection_date, violation_count, critical_count")
        .eq("establishment_id", est.id)
        .order("inspection_date", { ascending: false })
        .limit(5);

      if (!inspections || inspections.length === 0) {
        skipped++;
        continue;
      }

      const latest = inspections[0];
      const riskLevel = est.risk_level || 2;

      // Calculate new score
      const newScore = calculateCleanPlateScore(latest, inspections, riskLevel);

      // Calculate pass streak
      let passStreak = 0;
      for (const insp of inspections) {
        const result = insp.results.toLowerCase();
        if (result.includes("pass") && !result.includes("fail")) {
          passStreak++;
        } else {
          break;
        }
      }

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

        console.log(`${est.slug}: ${est.cleanplate_score} -> ${newScore}`);
        updated++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Error processing ${est.slug}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

function calculateCleanPlateScore(latest, inspections, riskLevel) {
  // Result component (40%)
  let resultScore = 50;
  const resultLower = latest.results.toLowerCase();
  if (resultLower.includes("pass") && !resultLower.includes("condition") && !resultLower.includes("fail")) {
    resultScore = 100;
  } else if (resultLower.includes("condition")) {
    resultScore = 70;
  } else if (resultLower.includes("fail")) {
    resultScore = 30;
  }

  // Trend component (20%)
  let trendScore = 0;
  if (inspections.length >= 3) {
    const last3 = inspections.slice(0, 3);
    const scores = last3.map((insp) => {
      const r = insp.results.toLowerCase();
      if (r.includes("pass") && !r.includes("condition") && !r.includes("fail")) return 100;
      if (r.includes("condition")) return 70;
      if (r.includes("fail")) return 30;
      return 50;
    });

    const first = scores[2];
    const middle = scores[1];
    const last = scores[0];

    if (last > middle && middle > first) trendScore = 10;
    else if (last < middle && middle < first) trendScore = -10;
  }

  // Violations component (20%)
  const violationsScore = Math.max(
    0,
    100 - (latest.critical_count * 15) - ((latest.violation_count - latest.critical_count) * 5)
  );

  // Recency component (10%)
  const daysSince = getDaysSinceInspection(latest.inspection_date);
  let recencyScore = 20;
  if (daysSince < 180) recencyScore = 100;
  else if (daysSince < 365) recencyScore = 80;
  else if (daysSince < 540) recencyScore = 50;

  // Risk component (10%)
  let riskScore = 80;
  if (riskLevel === 3) riskScore = 100;
  else if (riskLevel === 2) riskScore = 80;
  else if (riskLevel === 1) riskScore = 60;

  // Calculate base score
  let score =
    resultScore * 0.40 +
    trendScore * 0.20 +
    violationsScore * 0.20 +
    recencyScore * 0.10 +
    riskScore * 0.10;

  // Apply modifiers
  let passStreak = 0;
  for (const insp of inspections) {
    const r = insp.results.toLowerCase();
    if (r.includes("pass") && !r.includes("condition") && !r.includes("fail")) {
      passStreak++;
    } else {
      break;
    }
  }

  if (passStreak >= 3) score += 5;
  if (daysSince > 540) score -= 20;

  const hasRecentFailure = inspections.some(
    (insp) =>
      insp.results.toLowerCase().includes("fail") &&
      getDaysSinceInspection(insp.inspection_date) <= 90
  );
  if (hasRecentFailure) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getDaysSinceInspection(date) {
  const inspectionDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

recalculateAllScores().catch(console.error);

