"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Grid, Search, X, Building2, TrendingUp } from "lucide-react";

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  center_lat?: number;
  center_lng?: number;
  pass_rate?: number;
  restaurant_count?: number;
  avg_score?: number;
}

interface NeighborhoodChipsProps {
  selectedNeighborhood: string | null;
  onSelect: (neighborhood: Neighborhood | null) => void;
}

// Chicago neighborhood boundaries GeoJSON URL from Chicago Data Portal
const BOUNDARIES_URL = "https://data.cityofchicago.org/resource/igwz-8jzy.geojson";

// Common neighborhood nicknames mapped to official community area names
const NEIGHBORHOOD_ALIASES: Record<string, string[]> = {
  "lower-west-side": ["pilsen", "heart of chicago"],
  "lake-view": ["wrigleyville", "boystown", "southport corridor"],
  "near-west-side": ["west loop", "little italy", "greektown", "medical district", "tri-taylor", "university village"],
  "armour-square": ["chinatown"],
  "near-north-side": ["gold coast", "river north", "streeterville", "old town", "cabrini-green", "goose island"],
  "west-town": ["wicker park", "bucktown", "ukrainian village", "east village", "noble square", "smith park"],
  "logan-square": ["palmer square", "belmont gardens"],
  "lincoln-park": ["old town", "ranch triangle", "sheffield", "wrightwood"],
  "uptown": ["argyle", "little saigon", "buena park", "sheridan park"],
  "rogers-park": ["west ridge", "indian boundary"],
  "hyde-park": ["kenwood"],
  "bridgeport": ["mckinley park"],
  "humboldt-park": ["paseo boricua"],
  "albany-park": ["north mayfair", "ravenswood manor"],
  "edgewater": ["andersonville", "magnolia glen"],
  "north-center": ["roscoe village", "st. ben's"],
  "irving-park": ["old irving park", "independence park"],
  "avondale": ["koz park"],
  "lincoln-square": ["ravenswood", "bowmanville"],
};

// Calculate centroid from GeoJSON geometry
function calculateCentroid(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number] {
  let allPoints: number[][] = [];

  if (geometry.type === "Polygon") {
    // Polygon: coordinates is number[][][] - first ring is exterior
    const coords = geometry.coordinates as number[][][];
    allPoints = coords[0] || [];
  } else if (geometry.type === "MultiPolygon") {
    // MultiPolygon: coordinates is number[][][][] - collect all exterior rings
    const coords = geometry.coordinates as number[][][][];
    for (const polygon of coords) {
      const ring = polygon[0] || [];
      allPoints = allPoints.concat(ring);
    }
  }

  if (allPoints.length === 0) {
    return [-87.6298, 41.8781]; // Chicago default
  }

  let totalLng = 0;
  let totalLat = 0;
  for (const point of allPoints) {
    totalLng += point[0];
    totalLat += point[1];
  }

  return [totalLng / allPoints.length, totalLat / allPoints.length];
}

interface NeighborhoodGeoData {
  center: [number, number];
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

export function NeighborhoodChips({ selectedNeighborhood, onSelect }: NeighborhoodChipsProps) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const neighborhoodGeoRef = useRef<Record<string, NeighborhoodGeoData>>({});

  // Fetch neighborhood boundaries for center calculation and geometry
  useEffect(() => {
    fetch(BOUNDARIES_URL)
      .then((res) => res.json())
      .then((geojson) => {
        const geoData: Record<string, NeighborhoodGeoData> = {};
        for (const feature of geojson.features || []) {
          const name = (feature.properties?.pri_neigh || feature.properties?.community || "").toLowerCase();
          const slug = name.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          if (feature.geometry) {
            geoData[slug] = {
              center: calculateCentroid(feature.geometry),
              geometry: feature.geometry,
            };
          }
        }
        neighborhoodGeoRef.current = geoData;
      })
      .catch((err) => console.warn("Failed to fetch boundaries:", err));
  }, []);

  useEffect(() => {
    fetch("/api/neighborhoods?limit=100&sort=name")
      .then((res) => res.json())
      .then((data) => {
        setNeighborhoods(data.data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Filter neighborhoods by search (including aliases from both hardcoded list and database)
  const filteredNeighborhoods = searchQuery
    ? neighborhoods.filter((n) => {
        const query = searchQuery.toLowerCase();
        // Check official name
        if (n.name.toLowerCase().includes(query)) return true;
        // Check database alias (e.g., "West Loop" for Near West Side)
        if (n.alias && n.alias.toLowerCase().includes(query)) return true;
        // Check hardcoded aliases (sub-neighborhoods like "Pilsen", "Wrigleyville", etc.)
        const aliases = NEIGHBORHOOD_ALIASES[n.slug] || [];
        return aliases.some(alias => alias.includes(query));
      })
    : neighborhoods;
  
  // Get matching alias for display
  const getMatchingAlias = (neighborhood: Neighborhood): string | null => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    // Check database alias first
    if (neighborhood.alias && neighborhood.alias.toLowerCase().includes(query)) {
      return neighborhood.alias;
    }
    // Check hardcoded aliases
    const aliases = NEIGHBORHOOD_ALIASES[neighborhood.slug] || [];
    return aliases.find(alias => alias.includes(query)) || null;
  };

  // Get selected neighborhood name
  const selectedName = neighborhoods.find(n => n.slug === selectedNeighborhood)?.name;

  const handleSelectAndClose = (n: Neighborhood | null) => {
    if (n) {
      // Enrich with center coordinates and geometry from boundaries
      let foundGeo = neighborhoodGeoRef.current[n.slug];
      
      // If no match found by exact slug, try fuzzy match
      if (!foundGeo) {
        const normalizedName = n.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        foundGeo = neighborhoodGeoRef.current[normalizedName];
        
        // Try finding by partial match
        if (!foundGeo) {
          const keys = Object.keys(neighborhoodGeoRef.current);
          const match = keys.find(k => k.includes(n.slug) || n.slug.includes(k));
          if (match) {
            foundGeo = neighborhoodGeoRef.current[match];
          }
        }
      }
      
      const enriched = {
        ...n,
        center_lng: foundGeo?.center[0] || -87.6298,
        center_lat: foundGeo?.center[1] || 41.8781,
        geometry: foundGeo?.geometry,
      };
      onSelect(enriched);
    } else {
      onSelect(null);
    }
    setShowModal(false);
    setSearchQuery("");
  };

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-gray-200 rounded-full animate-pulse" />
        <div className="h-9 w-40 bg-gray-200 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {/* Simple Chip Row */}
      <div className="flex gap-2 flex-wrap">
        {/* All Areas chip */}
        <button
          onClick={() => handleSelectAndClose(null)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedNeighborhood === null
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50"
          }`}
        >
          <MapPin className="w-4 h-4" />
          All Areas
        </button>

        {/* Browse Neighborhoods button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(true);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedNeighborhood !== null
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <Grid className="w-4 h-4" />
          {selectedNeighborhood !== null ? selectedName : "Browse Neighborhoods"}
        </button>
      </div>

      {/* Full-screen Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Choose a Neighborhood</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 rounded-xl">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search neighborhoods..."
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                  autoFocus
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="p-1 hover:bg-gray-200 rounded-full"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Neighborhood Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredNeighborhoods.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No neighborhoods found</p>
                  <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredNeighborhoods.map((neighborhood) => {
                    const matchingAlias = getMatchingAlias(neighborhood);
                    return (
                      <button
                        key={neighborhood.id}
                        onClick={() => handleSelectAndClose(neighborhood)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          selectedNeighborhood === neighborhood.slug
                            ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300"
                            : "bg-gray-50 border border-gray-200 text-gray-800 hover:border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        <p className="font-medium text-sm truncate">{neighborhood.name}</p>
                        {matchingAlias && (
                          <p className={`text-xs mt-0.5 capitalize ${
                            selectedNeighborhood === neighborhood.slug ? "text-emerald-200" : "text-emerald-600"
                          }`}>
                            aka {matchingAlias}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {neighborhood.restaurant_count != null && (
                            <span className={`flex items-center gap-1 text-xs ${
                              selectedNeighborhood === neighborhood.slug ? "text-emerald-200" : "text-gray-500"
                            }`}>
                              <Building2 className="w-3 h-3" />
                              {neighborhood.restaurant_count}
                            </span>
                          )}
                          {neighborhood.pass_rate != null && (
                            <span className={`flex items-center gap-1 text-xs ${
                              selectedNeighborhood === neighborhood.slug ? "text-emerald-200" : "text-gray-500"
                            }`}>
                              <TrendingUp className="w-3 h-3" />
                              {neighborhood.pass_rate.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => handleSelectAndClose(null)}
                className="w-full py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Clear selection (show all areas)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
