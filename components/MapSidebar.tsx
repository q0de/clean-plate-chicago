"use client";

import { useState, useEffect, useRef } from "react";
import { Search, ArrowUpDown, Loader2, X, MapPin, TrendingUp, Building2, ChevronRight, Clock, AlertTriangle, Calendar } from "lucide-react";
import { NeighborhoodChips } from "./NeighborhoodChips";
import { MapRestaurantCard } from "./MapRestaurantCard";
import { StatusBadge } from "./StatusBadge";
import Link from "next/link";

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

interface Restaurant {
  id: string;
  slug: string;
  dba_name: string;
  address: string;
  cleanplate_score: number;
  latest_result: string;
  neighborhood?: string;
  neighborhood_slug?: string;
  latitude: number;
  longitude: number;
  latest_inspection_date?: string;
  violation_count?: number;
  risk_level?: number;
  facility_type?: string;
}

type SortOption = "score" | "name" | "recent";

interface MapSidebarProps {
  restaurants: Restaurant[];
  isLoading: boolean;
  selectedRestaurantId: string | null;
  hoveredRestaurantId: string | null;
  onRestaurantClick: (restaurant: Restaurant) => void;
  onRestaurantHover: (id: string | null) => void;
  onRestaurantDeselect?: () => void;
  onNeighborhoodSelect: (neighborhood: Neighborhood | null) => void;
  onSearch: (query: string) => void;
  selectedNeighborhood: string | null;
  selectedNeighborhoodData?: Neighborhood | null;
}

export function MapSidebar({
  restaurants,
  isLoading,
  selectedRestaurantId,
  hoveredRestaurantId,
  onRestaurantClick,
  onRestaurantHover,
  onRestaurantDeselect,
  onNeighborhoodSelect,
  onSearch,
  selectedNeighborhood,
  selectedNeighborhoodData,
}: MapSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [allNeighborhoods, setAllNeighborhoods] = useState<Neighborhood[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const restaurantListRef = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLDivElement>(null);

  // Fetch all neighborhoods for search
  useEffect(() => {
    fetch("/api/neighborhoods?limit=100&sort=name")
      .then((res) => res.json())
      .then((data) => setAllNeighborhoods(data.data || []))
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll to selected or hovered restaurant in list when it changes
  useEffect(() => {
    const restaurantIdToScroll = selectedRestaurantId || hoveredRestaurantId;
    if (restaurantIdToScroll && restaurantListRef.current) {
      // Longer delay to ensure DOM is updated and expansion animation completes
      setTimeout(() => {
        if (selectedCardRef.current) {
          selectedCardRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 300);
    }
  }, [selectedRestaurantId, hoveredRestaurantId]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "score", label: "Highest Score" },
    { value: "name", label: "Name A-Z" },
    { value: "recent", label: "Recently Inspected" },
  ];

  // Sort restaurants
  const sortedRestaurants = [...restaurants].sort((a, b) => {
    switch (sortBy) {
      case "score":
        return b.cleanplate_score - a.cleanplate_score;
      case "name":
        return a.dba_name.localeCompare(b.dba_name);
      case "recent":
        return 0; // Would need inspection date
      default:
        return 0;
    }
  });

  // Filter by search query (for list display)
  const filteredRestaurants = sortedRestaurants.filter((r) =>
    searchQuery
      ? r.dba_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.address.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  // Filter neighborhoods for dropdown
  const filteredNeighborhoods = searchQuery.length >= 2
    ? allNeighborhoods.filter((n) =>
        n.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  // Filter restaurants for dropdown
  const dropdownRestaurants = searchQuery.length >= 2
    ? restaurants.filter((r) =>
        r.dba_name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSearchSubmit = () => {
    onSearch(searchQuery);
    setShowSearchDropdown(false);
  };

  const handleNeighborhoodClick = (n: Neighborhood) => {
    onNeighborhoodSelect(n);
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const handleRestaurantSearchClick = (r: Restaurant) => {
    onRestaurantClick(r);
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const hasDropdownResults = filteredNeighborhoods.length > 0 || dropdownRestaurants.length > 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Search with Dropdown */}
      <div className="p-4 bg-white border-b border-gray-200 relative" ref={searchRef}>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(e.target.value.length >= 2);
            }}
            onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            placeholder="Search restaurants or neighborhoods..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setShowSearchDropdown(false);
              }}
              className="p-1 hover:bg-gray-200 rounded-full"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* Search Dropdown */}
        {showSearchDropdown && hasDropdownResults && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-30 max-h-80 overflow-y-auto">
            {/* Neighborhoods Section */}
            {filteredNeighborhoods.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Neighborhoods</span>
                </div>
                {filteredNeighborhoods.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNeighborhoodClick(n)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-emerald-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{n.name}</p>
                      <p className="text-xs text-gray-500">
                        {n.restaurant_count ?? "–"} restaurants • {n.pass_rate?.toFixed(0) ?? "–"}% pass rate
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Restaurants Section */}
            {dropdownRestaurants.length > 0 && (
              <div>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Restaurants</span>
                </div>
                {dropdownRestaurants.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRestaurantSearchClick(r)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      r.cleanplate_score >= 80 ? "bg-emerald-500" : r.cleanplate_score >= 60 ? "bg-amber-500" : "bg-red-500"
                    }`}>
                      {r.cleanplate_score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{r.dba_name}</p>
                      <p className="text-xs text-gray-500 truncate">{r.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Neighborhood Card - Expandable */}
      {selectedNeighborhoodData && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
          <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <h3 className="font-semibold">{selectedNeighborhoodData.name}</h3>
              </div>
              <button
                onClick={() => onNeighborhoodSelect(null)}
                className="p-1 hover:bg-emerald-500 rounded-full transition-colors"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Stats Grid */}
            <div className="p-4 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gray-100 rounded-full">
                  <Building2 className="w-4 h-4 text-gray-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {selectedNeighborhoodData.restaurant_count ?? restaurants.length}
                </p>
                <p className="text-xs text-gray-500">Restaurants</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gray-100 rounded-full">
                  <TrendingUp className="w-4 h-4 text-gray-600" />
                </div>
                <p className={`text-lg font-bold ${getScoreColor(selectedNeighborhoodData.avg_score ?? 0)}`}>
                  {selectedNeighborhoodData.avg_score?.toFixed(0) ?? "--"}
                </p>
                <p className="text-xs text-gray-500">Avg Score</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 mx-auto mb-1 bg-gray-100 rounded-full">
                  <span className="text-sm">✓</span>
                </div>
                <p className="text-lg font-bold text-emerald-600">
                  {selectedNeighborhoodData.pass_rate?.toFixed(0) ?? "--"}%
                </p>
                <p className="text-xs text-gray-500">Pass Rate</p>
              </div>
            </div>

            {/* Action Button */}
            <div className="px-4 pb-4">
              <Link
                href={`/neighborhood/${selectedNeighborhoodData.slug}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
              >
                View Neighborhood Details
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Neighborhoods */}
      <div className="p-4 bg-white border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {selectedNeighborhood ? "Change Neighborhood" : "Neighborhoods"}
        </h3>
        <NeighborhoodChips
          selectedNeighborhood={selectedNeighborhood}
          onSelect={onNeighborhoodSelect}
        />
      </div>

      {/* Sort & Count */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </span>
          ) : (
            `${filteredRestaurants.length} restaurants`
          )}
        </span>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOptions.find((o) => o.value === sortBy)?.label}
          </button>

          {showSortMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSortMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      sortBy === option.value
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Restaurant List */}
      <div ref={restaurantListRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          // Loading skeletons
          [...Array(5)].map((_, i) => (
            <div key={i} className="p-3 rounded-xl border-2 border-gray-200 bg-white animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-32 bg-gray-200 rounded mb-1" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-4xl mb-3 block">🍽️</span>
            <p className="text-gray-500 font-medium">No restaurants found</p>
            <p className="text-sm text-gray-400 mt-1">
              Try adjusting your filters or zoom out
            </p>
          </div>
        ) : (
          filteredRestaurants.map((restaurant) => {
            const isSelected = selectedRestaurantId === restaurant.id;
            const isHovered = hoveredRestaurantId === restaurant.id;
            const shouldScroll = isSelected || isHovered;
            return (
              <div
                key={restaurant.id}
                ref={shouldScroll ? selectedCardRef : null}
              >
                <MapRestaurantCard
                  restaurant={restaurant}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  onHover={onRestaurantHover}
                  onClick={() => onRestaurantClick(restaurant)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

