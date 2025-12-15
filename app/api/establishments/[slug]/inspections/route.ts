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

    return NextResponse.json({
      data: inspections || [],
      meta: {
        total: inspections?.length || 0,
        limit,
      },
    });
  } catch (error) {
    console.error("Inspections route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



