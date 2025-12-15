import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateAISummary } from "@/lib/ai-summary";

// Extract key violation themes from raw violations text
function extractViolationThemes(rawViolations: string | null): string[] {
  if (!rawViolations) return [];
  
  const themes: string[] = [];
  const text = rawViolations.toLowerCase();
  
  // Check for common violation categories
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
  
  return themes.slice(0, 3); // Return top 3 themes
}

// Generate AI-like summary based on inspection data
function generateInspectionSummary(
  result: string,
  inspectionType: string | null,
  violationCount: number,
  criticalCount: number,
  themes: string[]
): string {
  const isPass = result.toLowerCase().includes("pass") && !result.toLowerCase().includes("fail");
  const isConditional = result.toLowerCase().includes("condition");
  
  // Build contextual summary
  let summary = "";
  
  if (isPass && violationCount === 0) {
    summary = "Clean inspection with no issues found.";
  } else if (isPass && criticalCount === 0 && violationCount <= 2) {
    summary = `Minor items noted but all standards met.`;
  } else if (isPass) {
    if (themes.length > 0) {
      summary = `Passed with notes on ${themes.slice(0, 2).map(t => t.split(" ")[1]).join(" & ")}.`;
    } else {
      summary = `${violationCount} items flagged but passed inspection.`;
    }
  } else if (isConditional) {
    if (criticalCount > 0) {
      summary = `Needs follow-up on ${criticalCount} critical item${criticalCount > 1 ? "s" : ""}`;
      if (themes.length > 0) summary += ` (${themes[0]})`;
      summary += ".";
    } else {
      summary = `Conditional: ${violationCount} issues require attention.`;
    }
  } else {
    // Failed
    if (themes.length > 0) {
      summary = `Failed due to ${themes.slice(0, 2).map(t => t.split(" ")[1]).join(", ")} concerns.`;
    } else {
      summary = `Did not pass: ${violationCount} violation${violationCount > 1 ? "s" : ""} found.`;
    }
  }
  
  // Add inspection type context
  if (inspectionType) {
    const type = inspectionType.toLowerCase();
    if (type.includes("complaint")) {
      summary += " (Complaint-driven inspection)";
    } else if (type.includes("re-inspection")) {
      summary += " (Follow-up visit)";
    }
  }
  
  return summary;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radiusMiles = parseFloat(searchParams.get("radius_miles") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("nearby_establishments", {
      lat,
      lng,
      radius_miles: radiusMiles,
    });

    if (error) {
      console.error("Nearby search error:", error);
      return NextResponse.json(
        { error: "Failed to find nearby establishments" },
        { status: 500 }
      );
    }

    // Get establishment IDs to fetch latest inspection details
    const establishmentIds = (data || []).map((item: Record<string, unknown>) => item.id);
    
    // Fetch latest inspection for each establishment
    let inspectionMap: Record<string, { inspection_type: string; raw_violations: string; critical_count: number }> = {};
    
    if (establishmentIds.length > 0) {
      const { data: inspections } = await supabase
        .from("inspections")
        .select("establishment_id, inspection_type, raw_violations, critical_count")
        .in("establishment_id", establishmentIds)
        .order("inspection_date", { ascending: false });
      
      // Build map of latest inspection per establishment
      if (inspections) {
        for (const insp of inspections) {
          if (!inspectionMap[insp.establishment_id]) {
            inspectionMap[insp.establishment_id] = insp;
          }
        }
      }
    }

    // Enhance each establishment with AI summary
    const limitedData = (data || []).slice(0, limit);
    
    // Generate AI summaries in parallel
    const enhanced = await Promise.all(
      limitedData.map(async (item: Record<string, unknown>) => {
        const inspection = inspectionMap[item.id as string];
        const themes = inspection ? extractViolationThemes(inspection.raw_violations) : [];
        
        // Generate real AI summary
        let aiSummary: string | null = null;
        try {
          aiSummary = await generateAISummary({
            dba_name: item.dba_name as string,
            facility_type: (item.facility_type as string) || "Restaurant",
            latest_result: item.latest_result as string,
            cleanplate_score: (item.cleanplate_score as number) || 0,
            violation_count: (item.violation_count as number) || 0,
            critical_count: inspection?.critical_count || 0,
            raw_violations: inspection?.raw_violations || null,
            inspection_type: inspection?.inspection_type || null,
            latest_inspection_date: (item.latest_inspection_date as string) || null,
          });
        } catch (e) {
          console.error("AI summary error:", e);
          // Fall back to template summary
          aiSummary = generateInspectionSummary(
            item.latest_result as string,
            inspection?.inspection_type || null,
            (item.violation_count as number) || 0,
            inspection?.critical_count || 0,
            themes
          );
        }
        
        return {
          ...item,
          latitude: typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude,
          longitude: typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude,
          inspection_type: inspection?.inspection_type || null,
          critical_count: inspection?.critical_count || 0,
          violation_themes: themes,
          ai_summary: aiSummary,
        };
      })
    );

    return NextResponse.json({
      data: enhanced,
      meta: {
        total: enhanced.length,
        limit,
        offset: 0,
        has_more: (data?.length || 0) > limit,
      },
    });
  } catch (error) {
    console.error("Nearby route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


