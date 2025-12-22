const YELP_API_KEY = process.env.YELP_API_KEY;
const YELP_BASE_URL = "https://api.yelp.com/v3";

interface YelpBusiness {
  id: string;
  name: string;
  image_url: string;
  url: string;
  photos?: string[];
  phone?: string;
  display_phone?: string;
  is_closed?: boolean;
  hours?: Array<{
    open: Array<{
      is_overnight: boolean;
      start: string;
      end: string;
      day: number;
    }>;
    hours_type: string;
    is_open_now: boolean;
  }>;
  location: {
    address1: string;
    city: string;
    state: string;
    zip_code: string;
  };
}

export interface ExtendedRestaurantData {
  imageUrl: string | null;
  phone: string | null;
  isOpenNow: boolean | null;
  yelpUrl: string | null;
  source: "yelp" | "google" | null;
}

interface YelpSearchResponse {
  businesses: YelpBusiness[];
  total: number;
}

/**
 * Normalize a string for comparison (lowercase, remove special chars)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two business names are similar enough
 */
function isNameMatch(name1: string, name2: string): boolean {
  const n1 = normalizeString(name1);
  const n2 = normalizeString(name2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check if first few words match
  const words1 = n1.split(' ').slice(0, 2).join(' ');
  const words2 = n2.split(' ').slice(0, 2).join(' ');
  if (words1 === words2 && words1.length > 3) return true;
  
  // Compare without any spaces (handles "Organiclife" vs "Organic Life")
  const noSpace1 = n1.replace(/\s/g, '');
  const noSpace2 = n2.replace(/\s/g, '');
  if (noSpace1 === noSpace2) return true;
  if (noSpace1.includes(noSpace2) || noSpace2.includes(noSpace1)) return true;
  
  // Handle truncated names (e.g., "CUBANITO EXPRES" vs "Cubanito Express")
  // Check if one starts with most of the other (90% match)
  const shorter = noSpace1.length < noSpace2.length ? noSpace1 : noSpace2;
  const longer = noSpace1.length < noSpace2.length ? noSpace2 : noSpace1;
  if (shorter.length >= 8 && longer.startsWith(shorter.slice(0, -1))) return true;
  
  return false;
}

/**
 * Check if addresses are similar (same street number)
 */
function isAddressMatch(addr1: string, addr2: string): boolean {
  // Extract street number from addresses
  const num1 = addr1.match(/^\d+/)?.[0];
  const num2 = addr2.match(/^\d+/)?.[0];
  
  if (num1 && num2 && num1 === num2) return true;
  
  return false;
}

/**
 * Search for a business on Yelp by name and location
 */
export async function searchYelpBusiness(
  name: string,
  address: string,
  city: string = "Chicago"
): Promise<YelpBusiness | null> {
  if (!YELP_API_KEY) {
    console.error("YELP_API_KEY is not set");
    return null;
  }

  try {
    // First try with full address
    let params = new URLSearchParams({
      term: name,
      location: `${address}, ${city}, IL`,
      limit: "5",
      categories: "restaurants,food,cafes,bakeries,bars",
    });

    let response = await fetch(
      `${YELP_BASE_URL}/businesses/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${YELP_API_KEY}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      console.error("Yelp API error:", response.status, await response.text());
      return null;
    }

    let data: YelpSearchResponse = await response.json();
    
    // If no results, try with just city
    if (!data.businesses || data.businesses.length === 0) {
      console.log(`No results with full address, trying city-only search for "${name}"`);
      params = new URLSearchParams({
        term: name,
        location: `${city}, IL`,
        limit: "5",
      });
      
      response = await fetch(
        `${YELP_BASE_URL}/businesses/search?${params}`,
        {
          headers: {
            Authorization: `Bearer ${YELP_API_KEY}`,
            "Content-Type": "application/json",
          },
          next: { revalidate: 86400 },
        }
      );
      
      if (response.ok) {
        data = await response.json();
      }
    }
    
    // If still no results and name looks truncated, try adding common endings
    if (!data.businesses || data.businesses.length === 0) {
      // Try common fixes for truncated names (e.g., "EXPRES" -> "EXPRESS")
      const nameFixes = [
        name + "S",           // EXPRES -> EXPRESS
        name + "ES",          // Missing ES
        name + "'S",          // Missing 'S
        name.replace(/\s+/g, " ").trim(), // Clean whitespace
      ];
      
      for (const fixedName of nameFixes) {
        console.log(`Trying name variation: "${fixedName}"`);
        params = new URLSearchParams({
          term: fixedName,
          location: `${address}, ${city}, IL`,
          limit: "5",
          categories: "restaurants,food,cafes,bakeries,bars",
        });
        
        response = await fetch(
          `${YELP_BASE_URL}/businesses/search?${params}`,
          {
            headers: {
              Authorization: `Bearer ${YELP_API_KEY}`,
              "Content-Type": "application/json",
            },
            next: { revalidate: 86400 },
          }
        );
        
        if (response.ok) {
          data = await response.json();
          if (data.businesses && data.businesses.length > 0) {
            console.log(`Found results with name variation: "${fixedName}"`);
            break;
          }
        }
      }
    }
    
    if (!data.businesses || data.businesses.length === 0) {
      return null;
    }
    
    console.log(`Yelp search for "${name}" at "${address}" returned ${data.businesses.length} results`);
    
    // Find the best match by checking name AND address similarity
    for (const business of data.businesses) {
      const yelpAddress = business.location?.address1 || '';
      console.log(`  - Checking: "${business.name}" at "${yelpAddress}"`);
      
      // Check if both name and address match
      if (isNameMatch(name, business.name) && isAddressMatch(address, yelpAddress)) {
        console.log(`  ✓ Match found (name + address): ${business.name}`);
        return business;
      }
    }
    
    // If no exact match, check just name match
    for (const business of data.businesses) {
      if (isNameMatch(name, business.name)) {
        console.log(`  ✓ Match found (name only): ${business.name}`);
        return business;
      }
    }
    
    // If still no match, try address-only match (for rebranded businesses like Tel Aviv Bakery → Manna Bakehouse)
    for (const business of data.businesses) {
      const yelpAddress = business.location?.address1 || '';
      if (isAddressMatch(address, yelpAddress) && business.image_url) {
        console.log(`  ✓ Match found (address only, likely rebranded): ${business.name}`);
        return business;
      }
    }
    
    // No good match found - don't use fallback to avoid wrong images
    console.log(`  ✗ No good Yelp match for: ${name}`);
    return null;
  } catch (error) {
    console.error("Error searching Yelp:", error);
    return null;
  }
}

/**
 * Get business details including photos
 */
export async function getYelpBusinessDetails(
  businessId: string
): Promise<YelpBusiness | null> {
  if (!YELP_API_KEY) {
    console.error("YELP_API_KEY is not set");
    return null;
  }

  try {
    const response = await fetch(
      `${YELP_BASE_URL}/businesses/${businessId}`,
      {
        headers: {
          Authorization: `Bearer ${YELP_API_KEY}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      console.error("Yelp API error:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Yelp business details:", error);
    return null;
  }
}

/**
 * Get the primary image URL for a restaurant
 */
export async function getRestaurantImageUrl(
  name: string,
  address: string
): Promise<string | null> {
  const business = await searchYelpBusiness(name, address);
  
  if (business) {
    if (business.image_url) {
      console.log(`Yelp: "${business.name}" has image: ${business.image_url.substring(0, 50)}...`);
      return business.image_url;
    } else {
      console.log(`Yelp: "${business.name}" found but NO IMAGE available`);
    }
  }
  
  return null;
}

/**
 * Get extended restaurant data including image, phone, and hours
 */
export async function getExtendedRestaurantData(
  name: string,
  address: string
): Promise<ExtendedRestaurantData> {
  const business = await searchYelpBusiness(name, address);
  
  if (!business) {
    return {
      imageUrl: null,
      phone: null,
      isOpenNow: null,
      yelpUrl: null,
      source: null,
    };
  }
  
  // If we have a business ID, fetch full details to get hours
  let fullDetails = business;
  if (business.id) {
    const details = await getYelpBusinessDetails(business.id);
    if (details) {
      fullDetails = details;
    }
  }
  
  return {
    imageUrl: fullDetails.image_url || null,
    phone: fullDetails.display_phone || fullDetails.phone || null,
    isOpenNow: fullDetails.hours?.[0]?.is_open_now ?? null,
    yelpUrl: fullDetails.url || null,
    source: "yelp",
  };
}

