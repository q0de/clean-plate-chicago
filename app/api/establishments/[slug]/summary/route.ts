import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateAISummary } from "@/lib/ai-summary";

// Extract key violation themes from raw violations text
function extractViolationThemes(rawViolations: string | null): string[] {
  if (!rawViolations) return [];
  
  const themes: string[] = [];
  const text = rawViolations.toLowerCase();
  
  if (text.includes("rodent") || text.includes("mouse") || text.includes("rat") || text.includes("pest") || text.includes("insects")) {
    themes.push("🐭 Pest issues");
  }
  if (text.includes("temperature") || text.includes("cold holding") || text.includes("hot holding") || text.includes("refrigerat")) {
    themes.push("🌡️ Temperature control");
  }
  if (text.includes("handwash") || text.includes("hand wash") || text.includes("hand sink")) {
    themes.push("🖐️ Handwashing");
  }
  if (text.includes("clean") || text.includes("debris") || text.includes("soil") || text.includes("saniti")) {
    themes.push("🧹 Cleanliness");
  }
  if (text.includes("certificate") || text.includes("license") || text.includes("permit")) {
    themes.push("📋 Documentation");
  }
  if (text.includes("label") || text.includes("date mark")) {
    themes.push("🏷️ Food labeling");
  }
  if (text.includes("cutting board") || text.includes("equipment") || text.includes("repair")) {
    themes.push("🔧 Equipment");
  }
  if (text.includes("cross contam") || text.includes("raw") || text.includes("ready-to-eat")) {
    themes.push("⚠️ Cross-contamination");
  }
  if (text.includes("employee health") || text.includes("sick") || text.includes("illness")) {
    themes.push("🤒 Employee health");
  }
  if (text.includes("storage") || text.includes("floor") || text.includes("off the floor")) {
    themes.push("📦 Storage");
  }
  
  return themes.slice(0, 4); // Return top 4 themes
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch establishment with latest inspection details
    const { data: establishment, error: estError } = await supabase
      .from("establishments")
      .select(`
        id,
        dba_name,
        facility_type,
        latest_result,
        cleanplate_score,
        latest_inspection_date
      `)
      .eq("slug", slug)
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: "Establishment not found" },
        { status: 404 }
      );
    }

    // Fetch the latest inspection details
    const { data: inspection } = await supabase
      .from("inspections")
      .select("inspection_type, raw_violations, violation_count, critical_count")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(1)
      .single();

    const violationCount = inspection?.violation_count || 0;
    const criticalCount = inspection?.critical_count || 0;
    const inspectionType = inspection?.inspection_type || null;
    const rawViolations = inspection?.raw_violations || null;

    // Extract themes from violations
    const themes = extractViolationThemes(rawViolations);

    // Generate AI summary
    const summary = await generateAISummary({
      dba_name: establishment.dba_name,
      facility_type: establishment.facility_type || "Restaurant",
      latest_result: establishment.latest_result,
      cleanplate_score: establishment.cleanplate_score || 0,
      violation_count: violationCount,
      critical_count: criticalCount,
      inspection_type: inspectionType,
      raw_violations: rawViolations,
      latest_inspection_date: establishment.latest_inspection_date || null,
    });

    return NextResponse.json({
      summary,
      themes,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

