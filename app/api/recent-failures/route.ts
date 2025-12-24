import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const days = parseInt(searchParams.get("days") || "30");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    // Query inspections table directly to get the most recent inspections (active statuses only)
    // This ensures we're always getting current data, not relying on potentially stale establishment fields
    // Show mix of pass, conditional, and fail for "Trending" section
    // Exclude "Out of Business" - closed restaurants shouldn't appear in trending
    const { data: inspections, error: inspError } = await supabase
      .from("inspections")
      .select("id, inspection_date, results, establishment_id, raw_violations")
      .in("results", ["Pass", "Pass w/ Conditions", "Fail"])
      .gte("inspection_date", cutoffDateStr)
      .order("inspection_date", { ascending: false })
      .limit(limit * 3); // Get more to account for duplicates

    if (inspError) {
      console.error("Recent failures query error:", inspError);
      return NextResponse.json(
        { error: "Failed to fetch recent failures" },
        { status: 500 }
      );
    }

    if (!inspections || inspections.length === 0) {
      return NextResponse.json({
        data: [],
        meta: {
          total: 0,
          limit,
        },
      });
    }

    // Filter to get only the most recent inspection per establishment
    const seenEstablishments = new Set<string>();
    const uniqueInspectionMap = new Map<string, typeof inspections[0]>();

    for (const inspection of inspections) {
      const estId = inspection.establishment_id;
      if (!uniqueInspectionMap.has(estId)) {
        uniqueInspectionMap.set(estId, inspection);
        if (uniqueInspectionMap.size >= limit) {
          break;
        }
      }
    }

    // Get establishment IDs
    const establishmentIds = Array.from(uniqueInspectionMap.keys());

    // Fetch establishments - explicitly include slug to ensure it's returned
    const { data: establishments, error: estError } = await supabase
      .from("establishments")
      .select("*, slug") // Explicitly include slug
      .in("id", establishmentIds);

    if (estError) {
      console.error("Establishments query error:", estError);
      return NextResponse.json(
        { error: "Failed to fetch establishments" },
        { status: 500 }
      );
    }

    // Merge inspection data with establishment data, maintaining order by inspection date
    // Filter out any establishments without slugs to prevent 404 errors
    const uniqueInspections = establishments
      ?.filter((est) => {
        if (!est.slug || est.slug.trim() === '') {
          console.warn(`Establishment ${est.id} (${est.dba_name}) is missing slug, filtering out`);
          return false;
        }
        return true;
      })
      ?.map((est) => {
        const inspection = uniqueInspectionMap.get(est.id);
        return {
          ...est,
          latest_result: inspection?.results || est.latest_result,
          latest_inspection_date: inspection?.inspection_date || est.latest_inspection_date,
          raw_violations: inspection?.raw_violations || null,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.latest_inspection_date || 0).getTime();
        const dateB = new Date(b.latest_inspection_date || 0).getTime();
        return dateB - dateA; // Most recent first
      }) || [];

    return NextResponse.json(
      {
        data: uniqueInspections,
        meta: {
          total: uniqueInspections.length,
          limit,
        },
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
    console.error("Recent failures route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



