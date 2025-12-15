import { Metadata } from "next";
import { notFound } from "next/navigation";
import { NeighborhoodDetailClient } from "./NeighborhoodDetailClient";
import { supabase } from "@/lib/supabase";

// Disable static caching - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  pass_rate: number | null;
  avg_score: number | null;
  recent_failures: number;
  total_establishments: number;
}

async function getNeighborhood(slug: string): Promise<Neighborhood | null> {
  const { data, error } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Neighborhood;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const neighborhood = await getNeighborhood(params.slug);

  if (!neighborhood) {
    return {
      title: "Neighborhood Not Found | CleanPlate Chicago",
    };
  }

  return {
    title: `${neighborhood.name} Restaurant Health Scores | CleanPlate Chicago`,
    description: `Restaurant health inspection scores for ${neighborhood.name}. ${neighborhood.total_establishments} establishments, ${neighborhood.pass_rate ? neighborhood.pass_rate.toFixed(0) : "N/A"}% pass rate.`,
    openGraph: {
      title: `${neighborhood.name} - Restaurant Health Scores`,
      description: `Explore restaurant health inspection data for ${neighborhood.name}`,
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  // Generate static params for all 77 neighborhoods
  const { data } = await supabase
    .from("neighborhoods")
    .select("slug");

  if (!data) {
    return [];
  }

  return data.map((neighborhood) => ({
    slug: neighborhood.slug,
  }));
}

export default async function NeighborhoodPage({
  params,
}: {
  params: { slug: string };
}) {
  const neighborhood = await getNeighborhood(params.slug);

  if (!neighborhood) {
    notFound();
  }

  return <NeighborhoodDetailClient neighborhood={neighborhood} />;
}



