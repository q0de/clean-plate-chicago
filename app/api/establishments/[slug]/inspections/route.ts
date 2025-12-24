import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    // First get the establishment
    const { data: establishment, error: estError } = await supabase
      .from("establishments")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (estError || !establishment) {
      return NextResponse.json(
        { error: "Establishment not found" },
        { status: 404 }
      );
    }

    // Get inspections with violations
    // Use DISTINCT ON to ensure we only get one inspection per inspection_id
    // This handles any duplicates that might exist in the database
    const { data: inspections, error: inspError } = await supabase
      .from("inspections")
      .select(`
        *,
        violations (*)
      `)
      .eq("establishment_id", establishment.id)
      .order("inspection_date", { ascending: false })
      .limit(limit);

    if (inspError) {
      console.error("Inspections query error:", inspError);
      return NextResponse.json(
        { error: "Failed to fetch inspections" },
        { status: 500 }
      );
    }

    // Deduplicate by id as a safety measure (database now has unique composite index)
    const seenIds = new Set<string>();
    const deduplicatedInspections = (inspections || []).filter((inspection) => {
      if (seenIds.has(inspection.id)) {
        return false;
      }
      seenIds.add(inspection.id);
      return true;
    });

    return NextResponse.json(
      {
        data: deduplicatedInspections,
        meta: {
          total: deduplicatedInspections.length,
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
    console.error("Inspections route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}







