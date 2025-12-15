"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SearchInput } from "@/components/SearchInput";
import { RestaurantCard } from "@/components/RestaurantCard";
import { RestaurantCardSkeleton, RestaurantListSkeleton } from "@/components/RestaurantCardSkeleton";
import { FilterChips } from "@/components/FilterChips";
import { FilterModal, Filters } from "@/components/FilterModal";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { Map, ChevronLeft, SlidersHorizontal, Loader2 } from "lucide-react";

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
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedFilters, setSelectedFilters] = useState<("pass" | "conditional" | "fail")[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    result: "all",
    riskLevels: [],
    facilityType: "",
    lastInspected: "any",
    sortBy: "score",
  });

  const fetchRestaurants = useCallback(async (reset = false) => {
    if (!query.trim() && filters.result === "all" && !filters.facilityType) {
      setRestaurants([]);
      return;
    }

    setIsLoading(true);
    const currentOffset = reset ? 0 : offset;

    try {
      if (query.trim()) {
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20&offset=${currentOffset}`);
        const searchData = await searchRes.json();
        if (reset) {
          setRestaurants(searchData.data || []);
        } else {
          setRestaurants((prev) => [...prev, ...(searchData.data || [])]);
        }
        setHasMore(searchData.meta?.has_more || false);
        setOffset(currentOffset + (searchData.data?.length || 0));
      } else {
        const params = new URLSearchParams();
        params.append("limit", "20");
        params.append("offset", currentOffset.toString());
        if (filters.result !== "all") {
          params.append("result", filters.result);
        }
        if (filters.riskLevels.length > 0) {
          params.append("risk", filters.riskLevels[0]);
        }
        if (filters.facilityType) {
          params.append("facility_type", filters.facilityType);
        }
        params.append("sort", filters.sortBy);

        const res = await fetch(`/api/establishments?${params.toString()}`);
        const data = await res.json();
        if (reset) {
          setRestaurants(data.data || []);
        } else {
          setRestaurants((prev) => [...prev, ...(data.data || [])]);
        }
        setHasMore(data.meta?.has_more || false);
        setOffset(currentOffset + (data.data?.length || 0));
      }
    } catch (error) {
      console.error("Failed to fetch restaurants:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, filters, offset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      fetchRestaurants(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setOffset(0);
    fetchRestaurants(true);
  }, [filters]);

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      result: "all",
      riskLevels: [],
      facilityType: "",
      lastInspected: "any",
      sortBy: "score",
    });
    setSelectedFilters([]);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchRestaurants(false);
    }
  };

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          router.push(
            `/map?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
          );
        },
        () => {
          router.push("/map");
        }
      );
    } else {
      router.push("/map");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1 text-gray-600 hover:text-emerald-600 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-xl font-bold text-gray-900">Search</h1>
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            onLocationClick={handleLocationClick}
            onSubmit={() => fetchRestaurants(true)}
            placeholder="Search restaurants..."
          />
        </div>
      </header>

      {/* Filters Bar */}
      <section className="bg-white border-b border-gray-200 sticky top-[120px] z-40">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium text-gray-700 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
            <FilterChips
              selected={selectedFilters}
              onChange={setSelectedFilters}
              onFiltersClick={() => setIsFilterModalOpen(true)}
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {restaurants.length} result{restaurants.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => router.push("/map")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="View on map"
              >
                <Map className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="max-w-4xl mx-auto px-4 py-6">
        {isLoading && restaurants.length === 0 ? (
          <RestaurantListSkeleton />
        ) : restaurants.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <EmptyState
              type="no-results"
              query={query}
              onAction={() => {
                setQuery("");
                handleResetFilters();
              }}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {restaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.slug} restaurant={restaurant} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 mx-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        onApply={() => {}}
      />

      <BottomNav />
    </div>
  );
}
