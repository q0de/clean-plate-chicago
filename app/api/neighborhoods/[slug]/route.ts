import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { data, error } = await supabase
      .from("neighborhoods")
      .select("*")
      .eq("slug", params.slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Neighborhood not found" },
          { status: 404 }
        );
      }
      console.error("Neighborhood query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch neighborhood" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Neighborhood route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}







