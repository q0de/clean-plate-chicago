"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapRestaurantCard } from "@/components/MapRestaurantCard";
import { Map } from "@/components/Map";
import { BottomNav } from "@/components/BottomNav";
import { Map as MapIcon, ExternalLink } from "lucide-react";
import { Button, Card, CardBody, Select, SelectItem } from "@heroui/react";
import { MapRestaurant } from "@/lib/types";

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  pass_rate: number | null;
  avg_score: number | null;
  recent_failures: number;
  total_establishments: number;
}

interface Restaurant {
  slug: string;
  dba_name: string;
  address: string;
  neighborhood?: string;
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  violation_count?: number;
  risk_level?: number;
  latitude: number;
  longitude: number;
}

interface NeighborhoodDetailClientProps {
  neighborhood: Neighborhood;
}

export function NeighborhoodDetailClient({ neighborhood }: NeighborhoodDetailClientProps) {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState("score");
  const [showMap, setShowMap] = useState(false);

  const fetchRestaurants = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/neighborhoods/${neighborhood.slug}/establishments?sort=${sortBy}&limit=50`
      );
      const data = await res.json();
      setRestaurants(data.data || []);
    } catch (error) {
      console.error("Failed to fetch restaurants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [neighborhood.slug, sortBy]);

  const handleMarkerClick = (restaurant: MapRestaurant) => {
    router.push(`/restaurant/${restaurant.slug}`);
  };

  // Calculate center from restaurants
  const center: [number, number] = restaurants.length > 0
    ? [
        restaurants.reduce((sum, r) => sum + r.longitude, 0) / restaurants.length,
        restaurants.reduce((sum, r) => sum + r.latitude, 0) / restaurants.length,
      ]
    : [-87.6298, 41.8781];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="text-default-600 hover:text-primary"
            >
              ← Back
            </button>
            <h1 className="text-xl font-semibold">{neighborhood.name}</h1>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="container mx-auto px-4 py-6">
        <h2 className="text-lg font-semibold mb-4">
          Restaurant Health Scores in {neighborhood.name}
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card classNames={{ body: "p-4 text-center" }}>
            <CardBody>
              <div className="text-2xl font-bold text-primary">
                {neighborhood.pass_rate !== null ? `${neighborhood.pass_rate.toFixed(0)}%` : "N/A"}
              </div>
              <div className="text-xs text-default-500 mt-1">Pass Rate</div>
            </CardBody>
          </Card>
          <Card classNames={{ body: "p-4 text-center" }}>
            <CardBody>
              <div className="text-2xl font-bold text-primary">
                {neighborhood.avg_score !== null ? Math.round(neighborhood.avg_score) : "N/A"}
              </div>
              <div className="text-xs text-default-500 mt-1">Avg Score</div>
            </CardBody>
          </Card>
          <Card classNames={{ body: "p-4 text-center" }}>
            <CardBody>
              <div className="text-2xl font-bold text-danger">
                {neighborhood.recent_failures}
              </div>
              <div className="text-xs text-default-500 mt-1">Failed (30 days)</div>
            </CardBody>
          </Card>
        </div>

        {/* Map Toggle */}
        <div className="mb-4">
          <Button
            color="primary"
            variant="flat"
            startContent={<MapIcon className="w-4 h-4" />}
            endContent={<ExternalLink className="w-4 h-4" />}
            onPress={() => setShowMap(!showMap)}
          >
            {showMap ? "Hide" : "Show"} Map
          </Button>
        </div>

        {/* Map */}
        {showMap && restaurants.length > 0 && (
          <Card classNames={{ base: "mb-6 overflow-hidden" }}>
            <CardBody className="p-0">
              <Map
                restaurants={restaurants.map((r) => ({
                  id: r.slug,
                  slug: r.slug,
                  dba_name: r.dba_name,
                  address: r.address,
                  cleanplate_score: r.cleanplate_score,
                  latest_result: r.latest_result,
                  latitude: r.latitude,
                  longitude: r.longitude,
                }))}
                center={center}
                zoom={13}
                onMarkerClick={handleMarkerClick}
                className="w-full h-96"
              />
            </CardBody>
          </Card>
        )}
      </section>

      {/* Recent Failures */}
      {neighborhood.recent_failures > 0 && restaurants.filter((r) => r.latest_result.toLowerCase().includes("fail")).length > 0 && (
        <section className="container mx-auto px-4 py-4">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="text-danger">⚠️</span> Recent Failures
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants
              .filter((r) => r.latest_result.toLowerCase().includes("fail"))
              .slice(0, 6)
              .map((restaurant) => (
                <MapRestaurantCard 
                  key={restaurant.slug} 
                  restaurant={{
                    id: restaurant.slug,
                    slug: restaurant.slug,
                    dba_name: restaurant.dba_name,
                    address: restaurant.address,
                    cleanplate_score: restaurant.cleanplate_score,
                    latest_result: restaurant.latest_result,
                    latest_inspection_date: restaurant.latest_inspection_date,
                    violation_count: restaurant.violation_count,
                    risk_level: restaurant.risk_level,
                    neighborhood: neighborhood.name,
                  }}
                  onClick={() => router.push(`/restaurant/${restaurant.slug}`)}
                />
              ))}
          </div>
        </section>
      )}

      {/* All Restaurants */}
      <section className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            🍽️ All Restaurants ({neighborhood.total_establishments})
          </h3>
          <Select
            selectedKeys={[sortBy]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setSortBy(selected);
            }}
            size="sm"
            classNames={{ base: "w-40" }}
          >
            <SelectItem key="score">Score</SelectItem>
            <SelectItem key="date">Most Recent</SelectItem>
            <SelectItem key="name">A-Z</SelectItem>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <p className="text-default-500 text-center py-8">
            No restaurants found in this neighborhood
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restaurants.map((restaurant) => (
              <MapRestaurantCard 
                key={restaurant.slug} 
                restaurant={{
                  id: restaurant.slug,
                  slug: restaurant.slug,
                  dba_name: restaurant.dba_name,
                  address: restaurant.address,
                  cleanplate_score: restaurant.cleanplate_score,
                  latest_result: restaurant.latest_result,
                  latest_inspection_date: restaurant.latest_inspection_date,
                  violation_count: restaurant.violation_count,
                  risk_level: restaurant.risk_level,
                  neighborhood: neighborhood.name,
                }}
                onClick={() => router.push(`/restaurant/${restaurant.slug}`)}
              />
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}

