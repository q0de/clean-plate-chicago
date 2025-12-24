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

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    // Fetch establishment with latest inspection details AND cached summary
    const { data: establishment, error: estError } = await supabase
      .from("establishments")
      .select(`
        id,
        dba_name,
        facility_type,
        latest_result,
        cleanplate_score,
        latest_inspection_date,
        ai_summary,
        ai_summary_updated_at,
        ai_summary_score
      `)
      .eq("slug", slug)
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: "Establishment not found" },
        { 
          status: 404,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    // Fetch latest inspection to check if cache is still valid
    // We need to verify the latest inspection hasn't changed since cache was created
    const { data: latestInspectionCheck } = await supabase
      .from("inspections")
      .select("inspection_date, results, violation_count, critical_count")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(1)
      .single();

    // Check if we have a valid cached summary (less than 7 days old AND matches current inspection)
    if (establishment.ai_summary && establishment.ai_summary_updated_at) {
      const cacheAge = (Date.now() - new Date(establishment.ai_summary_updated_at).getTime()) / (1000 * 60 * 60 * 24);
      const cacheIsFresh = cacheAge < 7;
      
      // Check if latest inspection matches what the cache was based on
      // If inspection date changed or result changed, invalidate cache
      const cacheDate = new Date(establishment.ai_summary_updated_at);
      const latestInspectionDate = latestInspectionCheck?.inspection_date 
        ? new Date(latestInspectionCheck.inspection_date) 
        : null;
      
      const inspectionChanged = latestInspectionDate && latestInspectionDate > cacheDate;
      const resultChanged = latestInspectionCheck?.results && 
        latestInspectionCheck.results !== establishment.latest_result;
      
      // Check if score changed (e.g., from bulk recalculation or trigger update)
      // If ai_summary_score is NULL, treat as invalid (existing summaries without score)
      // If score doesn't match current score, invalidate cache
      const scoreMismatch = establishment.ai_summary_score === null || 
        establishment.ai_summary_score !== establishment.cleanplate_score;
      
      if (cacheIsFresh && !inspectionChanged && !resultChanged && !scoreMismatch) {
        // Return cached summary - skip expensive operations
        // Still need to fetch themes though
        const { data: inspections } = await supabase
          .from("inspections")
          .select("id, raw_violations")
          .eq("establishment_id", establishment.id)
          .order("inspection_date", { ascending: false })
          .limit(3);

        let themes: string[] = [];
        if (inspections && inspections.length > 0) {
          const inspectionIds = inspections.map(i => i.id);
          const { data: violations } = await supabase
            .from("violations")
            .select("violation_code, is_critical")
            .in("inspection_id", inspectionIds);
          
          if (violations && violations.length > 0) {
            themes = extractViolationThemesFromCodes(violations);
          } else {
            const allRaw = inspections.map(i => i.raw_violations).filter(Boolean).join(' ');
            themes = extractViolationThemesFromText(allRaw);
          }
        }

        return NextResponse.json(
          {
            summary: establishment.ai_summary,
            themes,
            generated_at: establishment.ai_summary_updated_at,
            cached: true,
          },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0',
            },
          }
        );
      }
    }

    // No valid cache - generate fresh summary
    // Fetch recent inspections (last 3) for trend context in AI summary
    const { data: inspections } = await supabase
      .from("inspections")
      .select("id, inspection_type, raw_violations, violation_count, critical_count, inspection_date, results")
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(3);

    const latestInspection = inspections?.[0];
    const violationCount = latestInspection?.violation_count || 0;
    const criticalCount = latestInspection?.critical_count || 0;
    const inspectionType = latestInspection?.inspection_type || null;
    const rawViolations = latestInspection?.raw_violations || null;

    // Fetch violations from ALL recent inspections for comprehensive theme extraction
    let themes: string[] = [];
    const allViolations: Violation[] = [];
    const allRawViolations: string[] = [];
    
    if (inspections && inspections.length > 0) {
      const inspectionIds = inspections.map(i => i.id);
      console.log(`[Summary] Looking for violations across ${inspectionIds.length} recent inspections`);
      
      const { data: violations, error: violError } = await supabase
        .from("violations")
        .select("violation_code, is_critical")
        .in("inspection_id", inspectionIds);
      
      console.log(`[Summary] Found ${violations?.length || 0} violations across recent inspections, error: ${violError?.message || 'none'}`);
      
      if (violations && violations.length > 0) {
        allViolations.push(...violations);
      }
      
      // Also collect raw_violations text for fallback
      inspections.forEach(insp => {
        if (insp.raw_violations) {
          allRawViolations.push(insp.raw_violations);
        }
      });
    }
    
    if (allViolations.length > 0) {
      // Use code-based theme extraction (more accurate)
      console.log(`[Summary] Using CODE-based extraction, codes: ${allViolations.map(v => v.violation_code).join(', ')}`);
      themes = extractViolationThemesFromCodes(allViolations);
    } else if (allRawViolations.length > 0) {
      // Fall back to text-based extraction from all inspections
      const combinedText = allRawViolations.join(' ');
      console.log(`[Summary] Using TEXT-based extraction from ${allRawViolations.length} inspections`);
      themes = extractViolationThemesFromText(combinedText);
    } else {
      console.log(`[Summary] No violations or raw text found`);
    }

    // CRITICAL: Always use the actual latest inspection data, not the establishments table
    // The establishments table may be stale if score hasn't been recalculated yet
    const latestResult = latestInspection?.results || establishment.latest_result;
    const latestDate = latestInspection?.inspection_date || establishment.latest_inspection_date;
    
    // Log if there's a mismatch to help debug score issues
    if (latestInspection && latestInspection.results !== establishment.latest_result) {
      console.warn(`[Summary] Inspection result mismatch for ${establishment.dba_name}: establishments table says "${establishment.latest_result}" but latest inspection says "${latestInspection.results}". Using latest inspection data.`);
    }

    // Prepare recent inspection history for AI context
    const recentInspections = inspections?.map(insp => ({
      inspection_date: insp.inspection_date,
      results: insp.results,
      violation_count: insp.violation_count,
      critical_count: insp.critical_count,
    })) || [];

    // Generate AI summary using the actual latest inspection data with history
    // This will use the database cache if available
    const summary = await generateAISummary({
      establishment_id: establishment.id,
      dba_name: establishment.dba_name,
      facility_type: establishment.facility_type || "Restaurant",
      latest_result: latestResult,
      cleanplate_score: establishment.cleanplate_score || 0,
      violation_count: violationCount,
      critical_count: criticalCount,
      inspection_type: inspectionType,
      raw_violations: rawViolations,
      latest_inspection_date: latestDate || null,
      recent_inspections: recentInspections.length > 1 ? recentInspections : undefined,
    });

    return NextResponse.json(
      {
        summary,
        themes,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error("Summary generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}

