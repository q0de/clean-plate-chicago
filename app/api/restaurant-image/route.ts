import { NextRequest, NextResponse } from "next/server";
import { getRestaurantImageUrl, getExtendedRestaurantData, generateFallbackTagline, ExtendedRestaurantData } from "@/lib/yelp";
import { getRestaurantImageFromGoogle } from "@/lib/google-places";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// How long before we consider cached data stale (30 days in ms)
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Check if cached data is stale (older than 30 days)
 */
function isDataStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true;
  const fetchedDate = new Date(fetchedAt);
  const now = new Date();
  return now.getTime() - fetchedDate.getTime() > STALE_THRESHOLD_MS;
}

/**
 * Fetch fresh data from Yelp/Google and save to database
 */
async function fetchAndSaveExternalData(
  establishmentId: string,
  name: string,
  address: string,
  facilityType: string
): Promise<ExtendedRestaurantData> {
  // Fetch from Yelp
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
  
  // If no tagline from Yelp, generate from facility type
  if (!yelpData.tagline && facilityType) {
    yelpData.tagline = generateFallbackTagline(facilityType);
  }
  
  // Save to database
  if (supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase
        .from("establishments")
        .update({ external_data: yelpData })
        .eq("id", establishmentId);
      console.log(`Saved external data for establishment ${establishmentId}`);
    } catch (error) {
      console.error("Error saving external data to database:", error);
    }
  }
  
  return yelpData;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get("name");
  const address = searchParams.get("address");
  const extended = searchParams.get("extended") === "true";
  const establishmentId = searchParams.get("establishment_id");
  const facilityType = searchParams.get("facility_type") || "Restaurant";

  if (!name || !address) {
    return NextResponse.json(
      { error: "Missing name or address parameter" },
      { status: 400 }
    );
  }

  try {
    // If extended data requested with establishment_id, use caching
    if (extended && establishmentId && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Check if we have cached data in the database
      const { data: establishment } = await supabase
        .from("establishments")
        .select("external_data")
        .eq("id", establishmentId)
        .single();
      
      const cachedData = establishment?.external_data as ExtendedRestaurantData | null;
      
      if (cachedData) {
        const stale = isDataStale(cachedData.fetchedAt);
        
        if (!stale) {
          // Fresh data - return it immediately
          console.log(`Returning cached data for "${name}" (fresh)`);
          return NextResponse.json(cachedData);
        } else {
          // Stale data - return it immediately but refresh in background
          console.log(`Returning cached data for "${name}" (stale, refreshing in background)`);
          
          // Fire and forget - refresh in background
          fetchAndSaveExternalData(establishmentId, name, address, facilityType)
            .catch(err => console.error("Background refresh failed:", err));
          
          return NextResponse.json(cachedData);
        }
      }
      
      // No cached data - fetch fresh and save
      console.log(`No cached data for "${name}", fetching fresh`);
      const freshData = await fetchAndSaveExternalData(establishmentId, name, address, facilityType);
      return NextResponse.json(freshData);
    }
    
    // Extended mode without caching (no establishment_id)
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
      
      // Generate fallback tagline if needed
      if (!yelpData.tagline && facilityType) {
        yelpData.tagline = generateFallbackTagline(facilityType);
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

