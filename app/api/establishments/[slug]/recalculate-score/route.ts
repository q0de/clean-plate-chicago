import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateCleanPlateScore } from "@/lib/score-calculator";

interface Inspection {
  results: string;
  inspection_date: string;
  violation_count: number;
  critical_count: number;
}

/**
 * POST /api/establishments/[slug]/recalculate-score
 * Recalculates and updates the CleanPlate Score for an establishment
 * 
 * Uses the v2.0 algorithm:
 * Score = (Result × 0.35) + (Violations × 0.25) + (Trend × 0.15) + (TrackRecord × 0.15) + (Recency × 0.10)
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
      .select("id, risk_level, cleanplate_score")
      .eq("slug", slug)
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: "Establishment not found" },
        { status: 404 }
      );
    }

    // Fetch recent inspections (get more for track record calculation)
    const { data: inspections, error: inspError } = await supabase
      .from("inspections")
      .select("results, inspection_date, violation_count, critical_count")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(10);

    if (inspError || !inspections || inspections.length === 0) {
      return NextResponse.json(
        { error: "No inspections found" },
        { status: 404 }
      );
    }

    const latest = inspections[0];
    const riskLevel = establishment.risk_level || 2;
    const oldScore = establishment.cleanplate_score;

    // Transform inspections to include risk_level for the calculator
    const inspectionsWithRisk = inspections.map((insp: Inspection) => ({
      ...insp,
      risk_level: riskLevel,
    }));

    // Calculate new score using shared calculator
    const newScore = calculateCleanPlateScore(
      { ...latest, risk_level: riskLevel },
      inspectionsWithRisk
    );

    // Calculate pass streak
    let passStreak = 0;
    for (const insp of inspections) {
      const result = insp.results.toLowerCase();
      if (result.includes("pass") && !result.includes("condition") && !result.includes("fail")) {
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
      old_score: oldScore,
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
