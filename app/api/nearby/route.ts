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

// Point-in-polygon check using ray casting algorithm
function isPointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Check if point is in any polygon of a MultiPolygon or Polygon
function isPointInGeoJSONGeometry(
  point: [number, number], 
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
): boolean {
  if (geometry.type === "Polygon") {
    // For Polygon, check against the outer ring (first array)
    return isPointInPolygon(point, geometry.coordinates[0] as number[][]);
  } else if (geometry.type === "MultiPolygon") {
    // For MultiPolygon, check if point is in any of the polygons
    for (const polygon of geometry.coordinates as number[][][][]) {
      if (isPointInPolygon(point, polygon[0])) {
        return true;
      }
    }
  }
  return false;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radiusMiles = parseFloat(searchParams.get("radius_miles") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const neighborhoodSlug = searchParams.get("neighborhood_slug");
    const neighborhoodBoundary = searchParams.get("neighborhood_boundary"); // JSON string of boundary

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    // Declare filteredData once with consistent type
    let filteredData: Record<string, unknown>[] = [];

    // If neighborhood slug provided, filter by neighborhood_id instead of location
    if (neighborhoodSlug) {
      // First get the neighborhood ID
      const { data: neighborhood } = await supabase
        .from("neighborhoods")
        .select("id")
        .eq("slug", neighborhoodSlug)
        .single();
      
      if (neighborhood) {
        const { data: neighEstablishments, error: neighError } = await supabase
          .from("establishments")
          .select("*, neighborhood:neighborhoods(name, slug)")
          .eq("neighborhood_id", neighborhood.id)
          .not("neighborhood_id", "is", null)
          .order("cleanplate_score", { ascending: false })
          .limit(limit);
        
        if (neighError) {
          console.error("Neighborhood establishments error:", neighError);
          return NextResponse.json(
            { error: "Failed to fetch neighborhood establishments" },
            { status: 500 }
          );
        }
        
        // Continue with the enhanced data flow below
        filteredData = (neighEstablishments || []) as Record<string, unknown>[];
      }
    } else {
      // Normal nearby search
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

      filteredData = (data || []) as Record<string, unknown>[];
      
      // Legacy: Filter by neighborhood boundary if provided (fallback)
      if (neighborhoodBoundary && !neighborhoodSlug) {
        try {
          const geometry = JSON.parse(neighborhoodBoundary);
          filteredData = filteredData.filter((item: Record<string, unknown>) => {
            const itemLat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude as number;
            const itemLng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude as number;
            if (!itemLat || !itemLng) return false;
            return isPointInGeoJSONGeometry([itemLng, itemLat], geometry);
          });
        } catch (e) {
          console.error("Failed to parse neighborhood boundary:", e);
        }
      }
    }

    // Get establishment IDs to fetch latest inspection details
    const establishmentIds = filteredData.map((item: Record<string, unknown>) => item.id);
    
    // Fetch latest inspection for each establishment
    let inspectionMap: Record<string, { inspection_type: string; raw_violations: string; critical_count: number; violation_count: number }> = {};
    
    if (establishmentIds.length > 0) {
      const { data: inspections } = await supabase
        .from("inspections")
        .select("establishment_id, inspection_type, raw_violations, critical_count, violation_count")
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
    const limitedData = filteredData.slice(0, limit);
    
    // Fetch neighborhood names and slugs for establishments that don't have them (from RPC function)
    const establishmentsNeedingNeighborhoods = limitedData.filter(
      (item: Record<string, unknown>) => !item.neighborhood && item.neighborhood_id
    );
    const neighborhoodIds = establishmentsNeedingNeighborhoods.map(
      (item: Record<string, unknown>) => item.neighborhood_id
    ).filter(Boolean);
    
    let neighborhoodMap: Record<string, { name: string; slug: string }> = {};
    if (neighborhoodIds.length > 0) {
      const { data: neighborhoods } = await supabase
        .from("neighborhoods")
        .select("id, name, slug")
        .in("id", neighborhoodIds);
      
      if (neighborhoods) {
        neighborhoods.forEach((n) => {
          neighborhoodMap[n.id] = { name: n.name, slug: n.slug };
        });
      }
    }
    
    // Generate AI summaries in parallel
    const enhanced = await Promise.all(
      limitedData.map(async (item: Record<string, unknown>) => {
        const inspection = inspectionMap[item.id as string];
        const themes = inspection ? extractViolationThemes(inspection.raw_violations) : [];
        
        // Extract neighborhood name and slug from joined data or fetch from map
        let neighborhoodName: string | null = null;
        let neighborhoodSlug: string | null = null;
        if (item.neighborhood && typeof item.neighborhood === 'object') {
          // From joined query: neighborhood: { name: string, slug?: string }
          const neighborhood = item.neighborhood as { name: string; slug?: string };
          neighborhoodName = neighborhood.name;
          neighborhoodSlug = neighborhood.slug || null;
        } else if (item.neighborhood_id && neighborhoodMap[item.neighborhood_id as string]) {
          // From RPC function: fetch from map
          const neighborhood = neighborhoodMap[item.neighborhood_id as string];
          neighborhoodName = neighborhood.name;
          neighborhoodSlug = neighborhood.slug;
        }
        
        // Generate real AI summary
        let aiSummary: string | null = null;
        try {
          aiSummary = await generateAISummary({
            dba_name: item.dba_name as string,
            facility_type: (item.facility_type as string) || "Restaurant",
            latest_result: item.latest_result as string,
            cleanplate_score: (item.cleanplate_score as number) || 0,
            violation_count: inspection?.violation_count || 0,
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
            inspection?.violation_count || 0,
            inspection?.critical_count || 0,
            themes
          );
        }
        
        // Remove the nested neighborhood object and add flat neighborhood field
        const { neighborhood: _, ...restItem } = item;
        
        return {
          ...restItem,
          latitude: typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude,
          longitude: typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude,
          neighborhood: neighborhoodName,
          neighborhood_slug: neighborhoodSlug,
          inspection_type: inspection?.inspection_type || null,
          violation_count: inspection?.violation_count || 0,
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
        has_more: filteredData.length > limit,
        neighborhood_filtered: !!neighborhoodBoundary,
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


