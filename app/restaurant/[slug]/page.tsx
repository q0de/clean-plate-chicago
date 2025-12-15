import { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantDetailClient } from "./RestaurantDetailClient";
import { supabase } from "@/lib/supabase";

interface Restaurant {
  id: string;
  slug: string;
  dba_name: string;
  aka_name?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  neighborhood?: { name: string; slug: string };
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  facility_type: string;
  risk_level: number;
  latitude: number;
  longitude: number;
}

async function getRestaurant(slug: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from("establishments")
    .select(`
      *,
      neighborhood:neighborhoods(name, slug)
    `)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Restaurant;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const restaurant = await getRestaurant(params.slug);

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
  const restaurant = await getRestaurant(params.slug);

  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetailClient restaurant={restaurant} />;
}



