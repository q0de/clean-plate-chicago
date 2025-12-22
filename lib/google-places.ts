const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  photos?: {
    photo_reference: string;
    height: number;
    width: number;
  }[];
}

interface PlacesSearchResponse {
  results: PlaceResult[];
  status: string;
}

/**
 * Search for a place using Google Places API
 */
export async function searchGooglePlace(
  name: string,
  address: string,
  city: string = "Chicago"
): Promise<PlaceResult | null> {
  if (!GOOGLE_API_KEY) {
    console.log("GOOGLE_PLACES_API_KEY not set, skipping Google Places search");
    return null;
  }

  // Try multiple query formats
  const queries = [
    `${name} ${address} ${city} IL`,           // Full query
    `${name} ${city} IL`,                       // Name + city only
    `${name} restaurant ${city}`,               // Add "restaurant" keyword
  ];

  for (const queryText of queries) {
    try {
      const query = encodeURIComponent(queryText);
      const url = `${GOOGLE_PLACES_BASE_URL}/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`;

      console.log(`Google Places: Trying query "${queryText}"`);
      
      const response = await fetch(url, {
        next: { revalidate: 86400 }, // Cache for 24 hours
      });

      if (!response.ok) {
        console.error("Google Places API error:", response.status, await response.text());
        continue;
      }

      const data: PlacesSearchResponse = await response.json();
      
      console.log(`Google Places: Status "${data.status}", results: ${data.results?.length || 0}`);

      if (data.status === "OK" && data.results && data.results.length > 0) {
        // Find a result with photos
        const placeWithPhoto = data.results.find(r => r.photos && r.photos.length > 0);
        if (placeWithPhoto) {
          console.log(`Google Places: Found "${placeWithPhoto.name}" with photo for "${name}"`);
          return placeWithPhoto;
        }
        // Return first result even without photo as fallback
        console.log(`Google Places: Found "${data.results[0].name}" (no photo) for "${name}"`);
        return data.results[0];
      }
    } catch (error) {
      console.error("Error searching Google Places:", error);
    }
  }

  console.log(`Google Places: No results found for "${name}"`);
  return null;
}

/**
 * Get photo URL from a Google Places photo reference
 */
export function getGooglePlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 400
): string {
  if (!GOOGLE_API_KEY) {
    return "";
  }
  return `${GOOGLE_PLACES_BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

/**
 * Get restaurant image from Google Places
 */
export async function getRestaurantImageFromGoogle(
  name: string,
  address: string
): Promise<string | null> {
  const place = await searchGooglePlace(name, address);

  if (place && place.photos && place.photos.length > 0) {
    const photoUrl = getGooglePlacePhotoUrl(place.photos[0].photo_reference);
    return photoUrl;
  }

  return null;
}

