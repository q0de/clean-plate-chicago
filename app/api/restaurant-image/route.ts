import { NextRequest, NextResponse } from "next/server";
import { getRestaurantImageUrl, getExtendedRestaurantData } from "@/lib/yelp";
import { getRestaurantImageFromGoogle } from "@/lib/google-places";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get("name");
  const address = searchParams.get("address");
  const extended = searchParams.get("extended") === "true";

  if (!name || !address) {
    return NextResponse.json(
      { error: "Missing name or address parameter" },
      { status: 400 }
    );
  }

  try {
    // If extended data requested, get full business info
    if (extended) {
      const yelpData = await getExtendedRestaurantData(name, address);
      
      // If Yelp didn't find an image, try Google Places as fallback
      if (!yelpData.imageUrl) {
        console.log(`Yelp found nothing for "${name}", trying Google Places for image...`);
        const googleImage = await getRestaurantImageFromGoogle(name, address);
        if (googleImage) {
          yelpData.imageUrl = googleImage;
          yelpData.source = "google";
        }
      }
      
      return NextResponse.json(yelpData);
    }

    // Simple mode - just get image
    let imageUrl = await getRestaurantImageUrl(name, address);

    // If Yelp didn't find an image, try Google Places as fallback
    if (!imageUrl) {
      console.log(`Yelp found nothing for "${name}", trying Google Places...`);
      imageUrl = await getRestaurantImageFromGoogle(name, address);
    }

    if (imageUrl) {
      return NextResponse.json({ imageUrl, source: imageUrl.includes("googleapis") ? "google" : "yelp" });
    } else {
      return NextResponse.json({ imageUrl: null });
    }
  } catch (error) {
    console.error("Error fetching restaurant image:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}

