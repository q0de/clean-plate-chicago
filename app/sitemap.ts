import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cleanplatechicago.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/map`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Get all restaurants
  const { data: restaurants } = await supabase
    .from("establishments")
    .select("slug, updated_at")
    .order("updated_at", { ascending: false })
    .limit(10000); // Limit to prevent timeout

  const restaurantPages: MetadataRoute.Sitemap =
    restaurants?.map((restaurant) => ({
      url: `${baseUrl}/restaurant/${restaurant.slug}`,
      lastModified: restaurant.updated_at ? new Date(restaurant.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) || [];

  // Get all neighborhoods
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("slug, updated_at");

  const neighborhoodPages: MetadataRoute.Sitemap =
    neighborhoods?.map((neighborhood) => ({
      url: `${baseUrl}/neighborhood/${neighborhood.slug}`,
      lastModified: neighborhood.updated_at ? new Date(neighborhood.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })) || [];

  return [...staticPages, ...restaurantPages, ...neighborhoodPages];
}



