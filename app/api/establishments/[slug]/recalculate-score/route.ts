import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface Inspection {
  results: string;
  inspection_date: string;
  violation_count: number;
  critical_count: number;
}

/**
 * POST /api/establishments/[slug]/recalculate-score
 * Recalculates and updates the CleanPlate Score for an establishment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch establishment
    const { data: establishment, error: estError } = await supabase
      .from("establishments")
      .select("id, risk_level")
      .eq("slug", slug)
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: "Establishment not found" },
        { status: 404 }
      );
    }

    // Fetch recent inspections (last 5 for trend calculation)
    const { data: inspections, error: inspError } = await supabase
      .from("inspections")
      .select("results, inspection_date, violation_count, critical_count")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(5);

    if (inspError || !inspections || inspections.length === 0) {
      return NextResponse.json(
        { error: "No inspections found" },
        { status: 404 }
      );
    }

    const latest = inspections[0];
    const riskLevel = establishment.risk_level || 2;

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

    // Update establishment with new score
    const { error: updateError } = await supabase
      .from("establishments")
      .update({
        cleanplate_score: newScore,
        pass_streak: passStreak,
        latest_result: latest.results,
        latest_inspection_date: latest.inspection_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", establishment.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update score" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      slug,
      old_score: null, // We don't track old score
      new_score: newScore,
      pass_streak: passStreak,
      latest_result: latest.results,
      latest_inspection_date: latest.inspection_date,
    });
  } catch (error) {
    console.error("Score recalculation error:", error);
    return NextResponse.json(
      { error: "Failed to recalculate score" },
      { status: 500 }
    );
  }
}

/**
 * Calculate CleanPlate Score based on PRD formula:
 * Score = (Result × 0.40) + (Trend × 0.20) + (Violations × 0.20) + (Recency × 0.10) + (Risk × 0.10)
 */
function calculateCleanPlateScore(
  latest: Inspection,
  inspections: Inspection[],
  riskLevel: number
): number {
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

    if (last > middle && middle > first) trendScore = 10; // improving
    else if (last < middle && middle < first) trendScore = -10; // declining
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

  // Risk component (10%) - lower risk level = better score
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
  
  if (passStreak >= 3) {
    score += 5;
  }

  if (daysSince > 540) {
    score -= 20;
  }

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

function getDaysSinceInspection(date: string): number {
  const inspectionDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - inspectionDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}





