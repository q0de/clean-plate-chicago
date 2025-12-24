import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!query.trim()) {
      return NextResponse.json(
        { data: [], meta: { total: 0, limit, offset, has_more: false } },
        { status: 200 }
      );
    }

    // Use full-text search function
    const { data, error } = await supabase.rpc("search_establishments", {
      query,
      lim: limit,
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: "Failed to search establishments" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data: data || [],
        meta: {
          total: data?.length || 0,
          limit,
          offset,
          has_more: (data?.length || 0) >= limit,
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
    console.error("Search route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



