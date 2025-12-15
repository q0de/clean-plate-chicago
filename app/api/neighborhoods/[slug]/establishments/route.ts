import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "score";

    // First get the neighborhood
    const { data: neighborhood, error: neighError } = await supabase
      .from("neighborhoods")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (neighError || !neighborhood) {
      return NextResponse.json(
        { error: "Neighborhood not found" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("establishments")
      .select("*", { count: "exact" })
      .eq("neighborhood_id", neighborhood.id);

    // Apply sorting
    if (sort === "score") {
      query = query.order("cleanplate_score", { ascending: false });
    } else if (sort === "date") {
      query = query.order("latest_inspection_date", { ascending: false });
    } else if (sort === "name") {
      query = query.order("dba_name", { ascending: true });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Neighborhood establishments query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch establishments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      meta: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Neighborhood establishments route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



