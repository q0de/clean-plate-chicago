import { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantDetailClient } from "./RestaurantDetailClient";
import { supabase } from "@/lib/supabase";

// Disable static caching - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Restaurant {
  id: string;
  slug: string;
  dba_name: string;
  aka_name?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  neighborhood?: { name: string; slug: string; alias?: string };
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  facility_type: string;
  risk_level: number;
  latitude: number;
  longitude: number;
}

function normalizeSlug(rawSlug: string): string {
  if (!rawSlug) return "";
  // Slugs are stored as lowercase in the database
  // Next.js already URL-decodes params, so just normalize casing and whitespace
  return rawSlug.trim().toLowerCase();
}

async function getRestaurant(slug: string): Promise<Restaurant | null> {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    console.error("getRestaurant: slug is empty or undefined");
    return null;
  }

  // Try exact match first
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      *,
      neighborhood:neighborhoods(name, slug, alias)
    `)
    .eq("slug", normalizedSlug)
    .single();

  if (error) {
    console.error("getRestaurant error:", error, "for slug:", normalizedSlug);
    // If not found, try case-insensitive search as fallback
    if (error.code === "PGRST116") {
      const { data: caseInsensitiveData, error: caseError } = await supabase
        .from("establishments")
        .select(`
          *,
          neighborhood:neighborhoods(name, slug, alias)
        `)
        .ilike("slug", normalizedSlug)
        .single();
      
      if (caseInsensitiveData) {
        console.log("Found restaurant via case-insensitive search");
        return caseInsensitiveData as Restaurant;
      }
      
      if (caseError) {
        console.error("Case-insensitive fallback also failed:", caseError);
      }
      
      // Additional fallback: try to extract name and license from slug
      // Slug format could be: {name}-{last-4-digits-of-license} OR {name}-{address}
      const slugParts = normalizedSlug.split('-');
      if (slugParts.length >= 2) {
        const lastPart = slugParts[slugParts.length - 1];
        // Check if last part looks like a 4-digit license suffix
        if (/^\d{4}$/.test(lastPart)) {
          const licenseSuffix = lastPart;
          console.log(`Attempting fallback search by license suffix: ${licenseSuffix}`);
          
          // Search by license number ending with these 4 digits
          const { data: licenseData, error: licenseError } = await supabase
            .from("establishments")
            .select(`
              *,
              neighborhood:neighborhoods(name, slug, alias)
            `)
            .like("license_number", `%${licenseSuffix}`)
            .limit(10);
          
          if (licenseData && licenseData.length > 0) {
            // If multiple matches, try to find the one that matches the name part
            const namePart = slugParts.slice(0, -1).join('-');
            const matching = licenseData.find(est => {
              const estSlug = est.slug?.toLowerCase() || '';
              const estName = est.dba_name?.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') || '';
              return estSlug.includes(namePart) || estSlug.endsWith(`-${licenseSuffix}`) || estName.includes(namePart);
            });
            
            if (matching) {
              console.log("Found restaurant via license suffix fallback");
              return matching as Restaurant;
            }
            
            // If no name match but we have results, return the first one
            if (licenseData.length === 1) {
              console.log("Found restaurant via license suffix fallback (single match)");
              return licenseData[0] as Restaurant;
            }
          }
          
          if (licenseError) {
            console.error("License suffix fallback also failed:", licenseError);
          }
        }
        
        // Try searching by name if license suffix didn't work
        // Extract restaurant name from slug (everything except last part if it's a number, or everything)
        const nameFromSlug = slugParts.slice(0, /^\d{4}$/.test(lastPart) ? -1 : slugParts.length).join(' ');
        if (nameFromSlug.length > 3) {
          console.log(`Attempting fallback search by name: ${nameFromSlug}`);
          const { data: nameData, error: nameError } = await supabase
            .from("establishments")
            .select(`
              *,
              neighborhood:neighborhoods(name, slug, alias)
            `)
            .ilike("dba_name", `%${nameFromSlug}%`)
            .limit(5);
          
          if (nameData && nameData.length > 0) {
            // Try to find exact match by comparing slugs
            const exactMatch = nameData.find(est => {
              const estSlug = est.slug?.toLowerCase() || '';
              // Check if slug matches or is similar
              return estSlug === normalizedSlug || estSlug.includes(normalizedSlug) || normalizedSlug.includes(estSlug);
            });
            
            if (exactMatch) {
              console.log("Found restaurant via name fallback with matching slug");
              return exactMatch as Restaurant;
            }
            
            // If single result, return it
            if (nameData.length === 1) {
              console.log("Found restaurant via name fallback (single match)");
              return nameData[0] as Restaurant;
            }
          }
          
          if (nameError) {
            console.error("Name fallback also failed:", nameError);
          }
        }
      }
    }
    return null;
  }

  if (!data) {
    console.error("getRestaurant: no data returned for slug:", slug);
    return null;
  }

  return data as Restaurant;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // Handle potential async params (Next.js 15+)
  let slug = typeof params.slug === 'string' ? params.slug : await params.slug;
  slug = slug?.trim().toLowerCase() || "";
  const restaurant = await getRestaurant(slug);

  if (!restaurant) {
    return {
      title: "Restaurant Not Found | CleanPlate Chicago",
    };
  }

  const status = restaurant.latest_result.toLowerCase().includes("fail")
    ? "Failed"
    : restaurant.latest_result.toLowerCase().includes("condition")
    ? "Conditional"
    : "Passed";

  return {
    title: `${restaurant.dba_name} Health Inspection | CleanPlate Chicago`,
    description: `${restaurant.dba_name} at ${restaurant.address} has a CleanPlate Score of ${restaurant.cleanplate_score}. Last inspected ${new Date(restaurant.latest_inspection_date).toLocaleDateString()}. Status: ${status}.`,
    openGraph: {
      title: `${restaurant.dba_name} - Score: ${restaurant.cleanplate_score}`,
      description: `Health inspection results for ${restaurant.dba_name}`,
      type: "website",
    },
  };
}

export default async function RestaurantPage({
  params,
}: {
  params: { slug: string };
}) {
  // Handle potential async params (Next.js 15+)
  let slug = typeof params.slug === 'string' ? params.slug : await params.slug;
  
  // Next.js automatically URL-decodes params, but handle edge cases
  if (!slug) {
    console.error("RestaurantPage: slug is empty");
    notFound();
  }

  // Normalize the slug (trim and lowercase - slugs in DB are lowercase)
  slug = slug.trim().toLowerCase();

  const restaurant = await getRestaurant(slug);

  if (!restaurant) {
    console.error("RestaurantPage: restaurant not found for slug:", slug);
    notFound();
  }

  return <RestaurantDetailClient restaurant={restaurant} />;
}



