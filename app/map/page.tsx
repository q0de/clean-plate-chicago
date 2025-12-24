"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Map, MapHandle } from "@/components/Map";
import { MapSidebar } from "@/components/MapSidebar";
import { BottomNav } from "@/components/BottomNav";
import { MapRestaurant } from "@/lib/types";
import { X, List } from "lucide-react";

interface Restaurant extends MapRestaurant {
  neighborhood?: string;
  neighborhood_slug?: string;
  latest_inspection_date?: string;
  violation_count?: number;
  risk_level?: number;
}

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  center_lat?: number;
  center_lng?: number;
  restaurant_count?: number;
  avg_score?: number;
  pass_rate?: number;
}

function MapPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mapRef = useRef<MapHandle>(null);
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [hoveredRestaurantId, setHoveredRestaurantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedNeighborhoodData, setSelectedNeighborhoodData] = useState<Neighborhood | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [colorMode, setColorMode] = useState<"inspection" | "score">("inspection");
  
  // Default to Loop coordinates if no URL params
  const hasUrlParams = !!(searchParams.get("lng") || searchParams.get("lat") || searchParams.get("zoom") || searchParams.get("neighborhood"));
  const targetRestaurantSlug = searchParams.get("slug"); // Restaurant to highlight by slug
  const targetRestaurantId = searchParams.get("selected"); // Restaurant to highlight by ID
  const targetNeighborhoodSlug = searchParams.get("neighborhood"); // Neighborhood to highlight
  const initialCenter: [number, number] = hasUrlParams
    ? [
        parseFloat(searchParams.get("lng") || "-87.6298"),
        parseFloat(searchParams.get("lat") || "41.8781"),
      ]
    : [-87.6298, 41.8781]; // Loop coordinates
  const initialZoom = parseFloat(searchParams.get("zoom") || (hasUrlParams ? "12" : "14"));
  
  // Use ref for center to avoid triggering re-fetches on every map move
  const centerRef = useRef<[number, number]>(initialCenter);
  const [zoom, setZoom] = useState(initialZoom);

  const fetchRestaurants = useCallback(async (
    lat?: number, 
    lng?: number, 
    neighborhoodSlug?: string
  ) => {
    setIsLoading(true);
    try {
      const fetchLat = lat ?? centerRef.current[1];
      const fetchLng = lng ?? centerRef.current[0];
      // Use light mode for fast initial load - only essential data for markers
      // For neighborhood queries, API returns all establishments (no limit)
      // For radius queries, use a reasonable limit
      let url = `/api/nearby?lat=${fetchLat}&lng=${fetchLng}&radius_miles=3&limit=500&light=true`;
      
      // Pass neighborhood slug for database-level filtering (returns all in neighborhood)
      if (neighborhoodSlug) {
        url += `&neighborhood_slug=${encodeURIComponent(neighborhoodSlug)}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      // Debug: Log all restaurants to check for slug issues
      const allRestaurants = data.data || [];
      const restaurantsWithSlugs = allRestaurants.filter((r: Restaurant) => r.slug && String(r.slug).trim() !== "");
      const restaurantsWithoutSlugs = allRestaurants.filter((r: Restaurant) => !r.slug || String(r.slug).trim() === "");
      
      if (restaurantsWithoutSlugs.length > 0) {
        console.warn(`Filtered out ${restaurantsWithoutSlugs.length} restaurants missing slugs:`, 
          restaurantsWithoutSlugs.map((r: Restaurant) => ({ id: r.id, name: r.dba_name, slug: r.slug }))
        );
      }
      
      let restaurantsData = restaurantsWithSlugs.map((r: Restaurant) => ({
        ...r,
        slug: String(r.slug).trim(),
      }));
      
      // Additional check: log any slugs that look problematic
      restaurantsData.forEach((r: Restaurant) => {
        if (!r.slug || r.slug.length === 0) {
          console.error("Restaurant in filtered list still has no slug:", r);
        }
      });
      
      // Additional validation: if neighborhood is selected, ensure all restaurants belong to it
      if (neighborhoodSlug) {
        restaurantsData = restaurantsData.filter((r: Restaurant) => 
          r.neighborhood_slug === neighborhoodSlug
        );
      }
      
      setRestaurants(restaurantsData);
    } catch (error) {
      console.error("Failed to fetch restaurants:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: default to Loop neighborhood if no URL params
  useEffect(() => {
    if (hasInitialized) return; // Only run once
    setHasInitialized(true);
    
    // If neighborhood param is in URL, load that neighborhood
    if (targetNeighborhoodSlug) {
      const loadTargetNeighborhood = async () => {
        try {
          const res = await fetch(`/api/neighborhoods/${targetNeighborhoodSlug}`);
          const data = await res.json();
          if (data.data) {
            const neighborhood = data.data;
            setSelectedNeighborhood(neighborhood.slug);
            setSelectedNeighborhoodData(neighborhood);
            
            // Use URL lat/lng if provided, otherwise use neighborhood center
            const urlLat = searchParams.get("lat");
            const urlLng = searchParams.get("lng");
            const neighborhoodCenter: [number, number] = urlLat && urlLng
              ? [parseFloat(urlLng), parseFloat(urlLat)]
              : neighborhood.center_lng && neighborhood.center_lat
                ? [neighborhood.center_lng, neighborhood.center_lat]
                : [-87.6298, 41.8781];
            
            centerRef.current = neighborhoodCenter;
            if (mapRef.current) {
              mapRef.current.flyTo(neighborhoodCenter, 14);
            }
            
            // Fetch restaurants for this neighborhood
            await fetchRestaurants(neighborhoodCenter[1], neighborhoodCenter[0], neighborhood.slug);
          }
        } catch (error) {
          console.error("Failed to load target neighborhood:", error);
          fetchRestaurants();
        }
      };
      
      loadTargetNeighborhood();
    } else if (!hasUrlParams) {
      // Default to Loop neighborhood
      const loadLoopNeighborhood = async () => {
        try {
          const res = await fetch("/api/neighborhoods/loop");
          const data = await res.json();
          if (data.data) {
            const loopNeighborhood = data.data;
            setSelectedNeighborhood(loopNeighborhood.slug);
            setSelectedNeighborhoodData(loopNeighborhood);
            
            // Set map center to Loop's center or default Loop coordinates
            const loopCenter: [number, number] = loopNeighborhood.center_lng && loopNeighborhood.center_lat
              ? [loopNeighborhood.center_lng, loopNeighborhood.center_lat]
              : [-87.6298, 41.8781]; // Default Loop coordinates
            
            centerRef.current = loopCenter;
            if (mapRef.current) {
              mapRef.current.flyTo(loopCenter, 14);
            }
            
            // Fetch restaurants for Loop - this will filter by neighborhood
            await fetchRestaurants(loopCenter[1], loopCenter[0], loopNeighborhood.slug);
          }
        } catch (error) {
          console.error("Failed to load Loop neighborhood:", error);
          // Fallback to default fetch
          fetchRestaurants();
        }
      };
      
      loadLoopNeighborhood();
    } else {
      // Use URL params or default
      fetchRestaurants();
    }
  }, [fetchRestaurants, hasUrlParams, hasInitialized, targetNeighborhoodSlug, searchParams]);

  // Handle selecting a specific restaurant from URL slug param
  useEffect(() => {
    if (targetRestaurantSlug && restaurants.length > 0 && !isLoading) {
      const targetRestaurant = restaurants.find(r => r.slug === targetRestaurantSlug);
      if (targetRestaurant) {
        // Select and highlight the restaurant
        setSelectedRestaurantId(targetRestaurant.id);
        setHoveredRestaurantId(targetRestaurant.id);
        
        // Pan map to restaurant with a slight delay to ensure map is ready
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.flyTo([targetRestaurant.longitude, targetRestaurant.latitude], 16);
          }
        }, 500);
        
        // Show mobile sidebar on mobile
        setShowMobileSidebar(true);
      }
    }
  }, [targetRestaurantSlug, restaurants, isLoading]);

  // Handle selecting a specific restaurant from URL ID param (from detail page "View Interactive Map")
  useEffect(() => {
    if (targetRestaurantId && !isLoading) {
      // Select and highlight the restaurant immediately
      setSelectedRestaurantId(targetRestaurantId);
      setHoveredRestaurantId(targetRestaurantId);
      
      // Show mobile sidebar on mobile
      setShowMobileSidebar(true);
      
      // If the restaurant is in our list, fly to it
      const targetRestaurant = restaurants.find(r => r.id === targetRestaurantId);
      if (targetRestaurant && mapRef.current) {
        mapRef.current.flyTo([targetRestaurant.longitude, targetRestaurant.latitude], 17);
      }
    }
  }, [targetRestaurantId, restaurants, isLoading]);

  const handleNeighborhoodSelect = (neighborhood: Neighborhood | null) => {
    if (neighborhood) {
      setSelectedNeighborhood(neighborhood.slug);
      setSelectedNeighborhoodData(neighborhood);
      // Fly to neighborhood center
      if (neighborhood.center_lat && neighborhood.center_lng && mapRef.current) {
        const newCenter: [number, number] = [neighborhood.center_lng, neighborhood.center_lat];
        mapRef.current.flyTo(newCenter, 14);
        centerRef.current = newCenter;
      }
      // Filter by neighborhood slug (uses database relationship)
      fetchRestaurants(neighborhood.center_lat, neighborhood.center_lng, neighborhood.slug);
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
    setSelectedRestaurantId(restaurant.id);
    // Pan map to restaurant
    if (mapRef.current) {
      mapRef.current.flyTo([restaurant.longitude, restaurant.latitude], 15);
    }
  };

  const handleMarkerClick = async (restaurant: MapRestaurant) => {
    const fullRestaurant = restaurants.find(r => r.id === restaurant.id);
    if (fullRestaurant) {
      // Set selectedRestaurantId to expand restaurant in list
      setSelectedRestaurantId(fullRestaurant.id);
      
      // Highlight the restaurant in the list
      setHoveredRestaurantId(fullRestaurant.id);
      
      // Pan map to restaurant
      if (mapRef.current) {
        mapRef.current.flyTo([restaurant.longitude, restaurant.latitude], 15);
      }
      
      // Auto-populate neighborhood card if restaurant has a neighborhood
      if (fullRestaurant.neighborhood_slug) {
        try {
          const res = await fetch(`/api/neighborhoods/${fullRestaurant.neighborhood_slug}`);
          const data = await res.json();
          if (data.data) {
            setSelectedNeighborhood(data.data.slug);
            setSelectedNeighborhoodData(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch neighborhood data:", error);
        }
      }
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
            selectedRestaurantId={selectedRestaurantId}
            hoveredRestaurantId={hoveredRestaurantId}
            onRestaurantClick={handleRestaurantClick}
            onRestaurantHover={setHoveredRestaurantId}
            onRestaurantDeselect={() => {
              setSelectedRestaurantId(null);
            }}
            onNeighborhoodSelect={handleNeighborhoodSelect}
            onSearch={handleSearch}
            selectedNeighborhood={selectedNeighborhood}
            selectedNeighborhoodData={selectedNeighborhoodData}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
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
            highlightedId={hoveredRestaurantId || selectedRestaurantId}
            selectedNeighborhoodSlug={selectedNeighborhood}
            colorMode={colorMode}
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
                selectedRestaurantId={selectedRestaurantId}
                hoveredRestaurantId={hoveredRestaurantId}
                onRestaurantClick={(r) => {
                  handleRestaurantClick(r);
                  setShowMobileSidebar(false);
                }}
                onRestaurantHover={setHoveredRestaurantId}
                onRestaurantDeselect={() => {
                  setSelectedRestaurantId(null);
                }}
                onNeighborhoodSelect={(n) => {
                  handleNeighborhoodSelect(n);
                  setShowMobileSidebar(false);
                }}
                onSearch={handleSearch}
                selectedNeighborhood={selectedNeighborhood}
                selectedNeighborhoodData={selectedNeighborhoodData}
                colorMode={colorMode}
                onColorModeChange={setColorMode}
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

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading map...</div>}>
      <MapPageContent />
    </Suspense>
  );
}
