"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Map, MapHandle } from "@/components/Map";
import { MapSidebar } from "@/components/MapSidebar";
import { BottomNav } from "@/components/BottomNav";
import { MapRestaurant } from "@/lib/types";
import { X, List } from "lucide-react";

interface Restaurant extends MapRestaurant {
  neighborhood?: string;
  latest_inspection_date?: string;
  violation_count?: number;
  risk_level?: number;
}

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  center_lat?: number;
  center_lng?: number;
  restaurant_count?: number;
  avg_score?: number;
  pass_rate?: number;
}

export default function MapPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapRef = useRef<MapHandle>(null);
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedNeighborhoodData, setSelectedNeighborhoodData] = useState<Neighborhood | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  const initialCenter: [number, number] = [
    parseFloat(searchParams.get("lng") || "-87.6298"),
    parseFloat(searchParams.get("lat") || "41.8781"),
  ];
  const initialZoom = parseFloat(searchParams.get("zoom") || "12");
  
  // Use ref for center to avoid triggering re-fetches on every map move
  const centerRef = useRef<[number, number]>(initialCenter);
  const [zoom, setZoom] = useState(initialZoom);

  const fetchRestaurants = useCallback(async (lat?: number, lng?: number, neighborhood?: string) => {
    setIsLoading(true);
    try {
      const fetchLat = lat ?? centerRef.current[1];
      const fetchLng = lng ?? centerRef.current[0];
      let url = `/api/nearby?lat=${fetchLat}&lng=${fetchLng}&radius_miles=3&limit=50`;
      if (neighborhood) {
        url += `&neighborhood=${encodeURIComponent(neighborhood)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setRestaurants(data.data || []);
    } catch (error) {
      console.error("Failed to fetch restaurants:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch only
  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const handleNeighborhoodSelect = (neighborhood: Neighborhood | null) => {
    if (neighborhood) {
      setSelectedNeighborhood(neighborhood.slug);
      setSelectedNeighborhoodData(neighborhood);
      // Fly to neighborhood center
      if (neighborhood.center_lat && neighborhood.center_lng && mapRef.current) {
        const newCenter: [number, number] = [neighborhood.center_lng, neighborhood.center_lat];
        mapRef.current.flyTo(newCenter, 14);
        centerRef.current = newCenter;
        fetchRestaurants(neighborhood.center_lat, neighborhood.center_lng, neighborhood.name);
      }
    } else {
      setSelectedNeighborhood(null);
      setSelectedNeighborhoodData(null);
      // Reset to Chicago center
      const chicagoCenter: [number, number] = [-87.6298, 41.8781];
      mapRef.current?.flyTo(chicagoCenter, 12);
      centerRef.current = chicagoCenter;
      fetchRestaurants(41.8781, -87.6298);
    }
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    // Pan map to restaurant
    if (mapRef.current) {
      mapRef.current.flyTo([restaurant.longitude, restaurant.latitude], 15);
    }
  };

  const handleMarkerClick = (restaurant: MapRestaurant) => {
    const fullRestaurant = restaurants.find(r => r.id === restaurant.id);
    if (fullRestaurant) {
      setSelectedRestaurant(fullRestaurant);
    }
  };

  const handleMapMove = (newCenter: [number, number], newZoom: number) => {
    centerRef.current = newCenter;
    setZoom(newZoom);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Desktop Layout: Sidebar + Map */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar - Hidden on mobile, visible on desktop */}
        <div className="hidden lg:flex lg:flex-col w-96 border-r border-gray-200 flex-shrink-0 h-full overflow-hidden">
          <MapSidebar
            restaurants={restaurants}
            isLoading={isLoading}
            selectedRestaurantId={selectedRestaurant?.id || null}
            selectedRestaurant={selectedRestaurant}
            hoveredRestaurantId={hoveredRestaurantId}
            onRestaurantClick={handleRestaurantClick}
            onRestaurantHover={setHoveredRestaurantId}
            onRestaurantDeselect={() => setSelectedRestaurant(null)}
            onNeighborhoodSelect={handleNeighborhoodSelect}
            onSearch={handleSearch}
            selectedNeighborhood={selectedNeighborhood}
            selectedNeighborhoodData={selectedNeighborhoodData}
          />
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <Map
            ref={mapRef}
            restaurants={restaurants}
            center={initialCenter}
            zoom={initialZoom}
            onMarkerClick={handleMarkerClick}
            onMoveEnd={handleMapMove}
            highlightedId={hoveredRestaurantId || selectedRestaurant?.id}
            selectedNeighborhoodSlug={selectedNeighborhood}
            className="absolute inset-0"
          />

          {/* Mobile toggle button */}
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="lg:hidden absolute top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-gray-200 font-medium text-gray-700"
          >
            <List className="w-4 h-4" />
            {restaurants.length} places
          </button>

          {/* Restaurant count pill (desktop) */}
          <div className="hidden lg:block absolute top-4 right-4 z-10">
            <span className="px-3 py-1.5 bg-white rounded-full shadow-md border border-gray-200 text-sm font-medium text-gray-600">
              {isLoading ? "Loading..." : `${restaurants.length} restaurants`}
            </span>
          </div>

        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileSidebar(false)}
          />
          
          {/* Slide-up panel */}
          <div className="absolute bottom-0 left-0 right-0 h-[85vh] bg-white rounded-t-3xl overflow-hidden animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>
            
            {/* Close button */}
            <button
              onClick={() => setShowMobileSidebar(false)}
              className="absolute top-3 right-4 p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            {/* Sidebar content */}
            <div className="h-full overflow-hidden">
              <MapSidebar
                restaurants={restaurants}
                isLoading={isLoading}
                selectedRestaurantId={selectedRestaurant?.id || null}
                selectedRestaurant={selectedRestaurant}
                hoveredRestaurantId={hoveredRestaurantId}
                onRestaurantClick={(r) => {
                  handleRestaurantClick(r);
                  setShowMobileSidebar(false);
                }}
                onRestaurantHover={setHoveredRestaurantId}
                onRestaurantDeselect={() => setSelectedRestaurant(null)}
                onNeighborhoodSelect={(n) => {
                  handleNeighborhoodSelect(n);
                  setShowMobileSidebar(false);
                }}
                onSearch={handleSearch}
                selectedNeighborhood={selectedNeighborhood}
                selectedNeighborhoodData={selectedNeighborhoodData}
              />
            </div>
          </div>
        </div>
      )}

      <BottomNav />

      {/* Animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
