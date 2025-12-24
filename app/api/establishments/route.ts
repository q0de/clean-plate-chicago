import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const result = searchParams.get("result");
    const risk = searchParams.get("risk");
    const facilityType = searchParams.get("facility_type");
    const zip = searchParams.get("zip");
    const neighborhood = searchParams.get("neighborhood");
    const sort = searchParams.get("sort") || "score";

    let query = supabase
      .from("establishments")
      .select("*", { count: "exact" });

    // Apply filters
    if (result && result !== "all") {
      if (result === "pass") {
        query = query.ilike("latest_result", "%pass%").not("latest_result", "ilike", "%condition%");
      } else if (result === "conditional") {
        query = query.ilike("latest_result", "%condition%");
      } else if (result === "fail") {
        query = query.ilike("latest_result", "%fail%");
      }
    }

    if (risk) {
      query = query.eq("risk_level", parseInt(risk));
    }

    if (facilityType) {
      query = query.eq("facility_type", facilityType);
    }

    if (zip) {
      query = query.eq("zip", zip);
    }

    if (neighborhood) {
      query = query.eq("neighborhood_id", neighborhood);
    }

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
      console.error("Establishments query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch establishments" },
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

    return NextResponse.json(
      {
        data: data || [],
        meta: {
          total: count || 0,
          limit,
          offset,
          has_more: (count || 0) > offset + limit,
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
    console.error("Establishments route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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



