import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") || "name";

    let query = supabase
      .from("neighborhoods")
      .select("*", { count: "exact" });

    // Apply sorting
    if (sort === "name") {
      query = query.order("name", { ascending: true });
    } else if (sort === "pass_rate") {
      query = query.order("pass_rate", { ascending: false, nullsFirst: false });
    } else if (sort === "avg_score") {
      query = query.order("avg_score", { ascending: false, nullsFirst: false });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Neighborhoods query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch neighborhoods" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      meta: {
        total: count || 0,
      },
    });
  } catch (error) {
    console.error("Neighborhoods route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


