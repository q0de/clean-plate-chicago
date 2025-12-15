import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateAISummary } from "@/lib/ai-summary";

interface Violation {
  violation_code: string;
  is_critical: boolean;
}

// Extract key violation themes from actual violation codes (more accurate than text matching)
function extractViolationThemesFromCodes(violations: Violation[]): string[] {
  if (!violations || violations.length === 0) return [];
  
  const themes: string[] = [];
  const codes = violations.map(v => parseInt(v.violation_code));
  
  // Check for pest violations (code 38)
  if (codes.includes(38)) {
    themes.push("🐭 Pest issues");
  }
  
  // Check for food safety/temperature violations (codes 6-20)
  if (codes.some(c => c >= 6 && c <= 20)) {
    themes.push("🌡️ Temperature control");
  }
  
  // Check for contamination violations (codes 21-31)
  if (codes.some(c => c >= 21 && c <= 31)) {
    themes.push("🧹 Cleanliness");
  }
  
  // Check for storage/labeling violations (codes 32-37)
  if (codes.some(c => c >= 32 && c <= 37)) {
    themes.push("📦 Storage");
  }
  
  // Check for chemical safety violations (codes 39-42)
  if (codes.some(c => c >= 39 && c <= 42)) {
    themes.push("⚠️ Chemical safety");
  }
  
  // Check for facilities violations (codes 43-58)
  if (codes.some(c => c >= 43 && c <= 58)) {
    themes.push("🔧 Equipment");
  }
  
  // Check for staff/certification violations (codes 1-5)
  if (codes.some(c => c >= 1 && c <= 5)) {
    themes.push("📋 Documentation");
  }
  
  return themes.slice(0, 4); // Return top 4 themes
}

// Fallback: Extract themes from raw text (used when violations aren't parsed)
function extractViolationThemesFromText(rawViolations: string | null): string[] {
  if (!rawViolations) return [];
  
  const themes: string[] = [];
  const text = rawViolations.toLowerCase();
  
  // More specific pest matching - require word boundaries
  if (/\b(rodent|mouse|mice|rat|pest|insect|roach|fly|flies)\b/.test(text)) {
    themes.push("🐭 Pest issues");
  }
  if (text.includes("temperature") || text.includes("cold holding") || text.includes("hot holding") || text.includes("refrigerat")) {
    themes.push("🌡️ Temperature control");
  }
  if (text.includes("handwash") || text.includes("hand wash") || text.includes("hand sink")) {
    themes.push("🖐️ Handwashing");
  }
  if (/\b(clean|debris|soil|saniti)/.test(text)) {
    themes.push("🧹 Cleanliness");
  }
  if (text.includes("certificate") || text.includes("license") || text.includes("permit")) {
    themes.push("📋 Documentation");
  }
  if (text.includes("label") || text.includes("date mark")) {
    themes.push("🏷️ Food labeling");
  }
  if (text.includes("equipment") || text.includes("repair") || text.includes("maintain")) {
    themes.push("🔧 Equipment");
  }
  if (text.includes("cross contam") || /\braw\b/.test(text) || text.includes("ready-to-eat")) {
    themes.push("⚠️ Cross-contamination");
  }
  if (text.includes("storage") || text.includes("off the floor") || text.includes("stored on")) {
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

    // Fetch the latest inspection directly by ordering (most reliable)
    // This ensures we always get the most recent data
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, inspection_type, raw_violations, violation_count, critical_count, inspection_date, results")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(1);

    const latestInspection = inspections?.[0];
    const violationCount = latestInspection?.violation_count || 0;
    const criticalCount = latestInspection?.critical_count || 0;
    const inspectionType = latestInspection?.inspection_type || null;
    const rawViolations = latestInspection?.raw_violations || null;

    // Fetch actual violations with codes for more accurate theme extraction
    let themes: string[] = [];
    if (latestInspection?.id) {
      const { data: violations } = await supabase
        .from("violations")
        .select("violation_code, is_critical")
        .eq("inspection_id", latestInspection.id);
      
      if (violations && violations.length > 0) {
        // Use code-based theme extraction (more accurate)
        themes = extractViolationThemesFromCodes(violations);
      } else {
        // Fall back to text-based extraction
        themes = extractViolationThemesFromText(rawViolations);
      }
    } else {
      themes = extractViolationThemesFromText(rawViolations);
    }

    // Use inspection data directly for freshest results
    const latestResult = latestInspection?.results || establishment.latest_result;
    const latestDate = latestInspection?.inspection_date || establishment.latest_inspection_date;

    // Generate AI summary using the actual latest inspection data
    const summary = await generateAISummary({
      dba_name: establishment.dba_name,
      facility_type: establishment.facility_type || "Restaurant",
      latest_result: latestResult,
      cleanplate_score: establishment.cleanplate_score || 0,
      violation_count: violationCount,
      critical_count: criticalCount,
      inspection_type: inspectionType,
      raw_violations: rawViolations,
      latest_inspection_date: latestDate || null,
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

