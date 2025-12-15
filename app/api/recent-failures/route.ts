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

    // Get establishments that failed in the last N days
    const { data, error } = await supabase
      .from("establishments")
      .select("*")
      .ilike("latest_result", "%fail%")
      .gte("latest_inspection_date", cutoffDate.toISOString().split("T")[0])
      .order("latest_inspection_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Recent failures query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent failures" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      meta: {
        total: data?.length || 0,
        limit,
      },
    });
  } catch (error) {
    console.error("Recent failures route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



