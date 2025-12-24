"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, Ref } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapRestaurant } from "@/lib/types";

export interface MapHandle {
  flyTo: (center: [number, number], zoom?: number) => void;
  getCenter: () => [number, number] | null;
}

type ColorMode = "inspection" | "score";

interface MapProps {
  restaurants: MapRestaurant[];
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (restaurant: MapRestaurant) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  highlightedId?: string | null;
  selectedNeighborhoodSlug?: string | null;
  colorMode?: ColorMode;
  className?: string;
}

// Chicago neighborhood boundaries GeoJSON URL from Chicago Data Portal
const BOUNDARIES_URL = "https://data.cityofchicago.org/resource/igwz-8jzy.geojson";

function MapComponent(
  { 
    restaurants, 
    center = [-87.6298, 41.8781], 
    zoom = 12,
    onMarkerClick,
    onMoveEnd,
    highlightedId,
    selectedNeighborhoodSlug,
    colorMode = "inspection",
    className = "w-full h-full"
  }: MapProps, 
  ref: Ref<MapHandle>
) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, { marker: mapboxgl.Marker; element: HTMLDivElement; innerElement: HTMLDivElement }>>(new globalThis.Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadMarkedRef = useRef(false);
  const boundariesRef = useRef<GeoJSON.FeatureCollection | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    flyTo: (newCenter: [number, number], newZoom?: number) => {
      mapInstance.current?.flyTo({
        center: newCenter,
        zoom: newZoom || 14,
        duration: 1500,
      });
    },
    getCenter: () => {
      const c = mapInstance.current?.getCenter();
      return c ? [c.lng, c.lat] : null;
    },
  }));

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    if (!mapboxgl.supported()) {
      setLoadError("WebGL is not supported in this browser/device.");
      return;
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Mapbox token not found");
      return;
    }

    mapboxgl.accessToken = token;

    mapInstance.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
      minZoom: 10,
      maxZoom: 18,
      maxBounds: [
        [-88.5, 41.5],
        [-87.0, 42.2]
      ],
    });

    const markLoaded = () => {
      if (loadMarkedRef.current) return;
      loadMarkedRef.current = true;
      setIsLoaded(true);
      setLoadError(null);
    };

    mapInstance.current.on("load", markLoaded);
    mapInstance.current.on("render", () => {
      if (mapInstance.current && mapInstance.current.isStyleLoaded() && !loadMarkedRef.current) {
        markLoaded();
      }
    });
    mapInstance.current.once("idle", () => {
      if (!loadMarkedRef.current) markLoaded();
    });
    mapInstance.current.on("styledata", () => {
      if (!loadMarkedRef.current) markLoaded();
    });

    mapInstance.current.on("error", (event) => {
      const message = (event as unknown as { error?: { message?: string } })?.error?.message || "Map failed to load.";
      console.error("Mapbox error:", message, event);
      setLoadError(message);
    });

    // Notify parent of map movement
    mapInstance.current.on("moveend", () => {
      if (mapInstance.current && onMoveEnd) {
        const c = mapInstance.current.getCenter();
        onMoveEnd([c.lng, c.lat], mapInstance.current.getZoom());
      }
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isLoaded && !loadError) {
        setLoadError("Map is taking longer than expected to load.");
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [isLoaded, loadError]);

  // Test style endpoint
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    const controller = new AbortController();
    fetch(`https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${token}`, {
      method: "GET",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          setLoadError(`Mapbox style request failed (${res.status}).`);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoadError("Unable to reach Mapbox.");
        }
      });
    return () => controller.abort();
  }, []);

  // Store restaurant data for click handlers
  const restaurantsRef = useRef<MapRestaurant[]>([]);
  restaurantsRef.current = restaurants;

  // Color constants - includes exceptional (90+) tier and closed (out of business)
  const colors: Record<string, string> = {
    closed: "#9ca3af",      // gray-400 for out of business
    exceptional: "#14b8a6", // teal-500 for 90+ scores (green-blue)
    pass: "#10b981",        // emerald-500 for 80-89 or passing inspection
    conditional: "#f59e0b", // amber-500 for 60-79 or conditional
    fail: "#ef4444",        // red-500 for <60 or failed
  };

  // Helper function to get marker status based on colorMode
  const getMarkerStatus = (restaurant: MapRestaurant, mode: ColorMode): "closed" | "exceptional" | "pass" | "conditional" | "fail" => {
    // Always check for out of business first
    const result = restaurant.latest_result.toLowerCase();
    if (result.includes("out of business")) return "closed";
    
    if (mode === "score") {
      // Color by CleanPlate Score - 4 tiers
      if (restaurant.cleanplate_score >= 90) return "exceptional";
      if (restaurant.cleanplate_score >= 80) return "pass";
      if (restaurant.cleanplate_score >= 60) return "conditional";
      return "fail";
    } else {
      // Color by Inspection Result (default) - no exceptional tier
      if (result.includes("fail")) return "fail";
      if (result.includes("condition")) return "conditional";
      return "pass";
    }
  };

  // Add/update markers - only when restaurants change, NOT when highlightedId changes
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return;

    const currentIds = new Set(restaurants.map(r => r.id));
    
    // Remove markers that are no longer in the list
    markersRef.current.forEach((data, id) => {
      if (!currentIds.has(id)) {
        data.marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Group restaurants by location to handle overlapping markers
    const locationMap = new globalThis.Map<string, number>();
    
    // Add new markers (don't update existing ones here)
    restaurants.forEach((restaurant) => {
      if (markersRef.current.has(restaurant.id)) {
        // Marker already exists, skip
        return;
      }

      const status = getMarkerStatus(restaurant, colorMode);

      // Validate coordinates
      if (typeof restaurant.longitude !== 'number' || typeof restaurant.latitude !== 'number' ||
          isNaN(restaurant.longitude) || isNaN(restaurant.latitude)) {
        console.warn(`Invalid coordinates for restaurant ${restaurant.id}:`, restaurant.longitude, restaurant.latitude);
        return;
      }

      // Create a location key (rounded to 4 decimal places to group nearby markers)
      const locationKey = `${restaurant.longitude.toFixed(4)},${restaurant.latitude.toFixed(4)}`;
      const markerIndex = locationMap.get(locationKey) || 0;
      locationMap.set(locationKey, markerIndex + 1);

      // Add small offset for overlapping markers (spiral pattern) - only if there are multiple at same location
      let finalLng = restaurant.longitude;
      let finalLat = restaurant.latitude;
      if (markerIndex > 0) {
        const offsetDistance = markerIndex * 0.0001; // ~11 meters per 0.0001 degrees
        const angle = markerIndex * (Math.PI * 2 / 6); // 6 markers in a circle
        finalLng = restaurant.longitude + (Math.cos(angle) * offsetDistance);
        finalLat = restaurant.latitude + (Math.sin(angle) * offsetDistance);
      }

      // Create new marker with inner element for scaling (to not interfere with Mapbox's transform)
      const el = document.createElement("div");
      el.className = "marker-container";
      el.style.cursor = "pointer";
      el.style.pointerEvents = "auto";
      
      // Inner circle element that we can safely scale without affecting Mapbox positioning
      const inner = document.createElement("div");
      inner.className = "marker-inner";
      inner.style.width = "16px";
      inner.style.height = "16px";
      inner.style.borderRadius = "50%";
      inner.style.backgroundColor = colors[status];
      inner.style.border = "3px solid white";
      inner.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      inner.style.transition = "transform 0.15s ease-out, box-shadow 0.15s ease-out";
      el.appendChild(inner);

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: "center"
      })
        .setLngLat([finalLng, finalLat])
        .addTo(mapInstance.current!);

      el.addEventListener("click", () => {
        const r = restaurantsRef.current.find(rest => rest.id === restaurant.id);
        if (r) onMarkerClick?.(r);
      });

      markersRef.current.set(restaurant.id, { marker, element: el, innerElement: inner });
    });
  }, [restaurants, isLoaded, onMarkerClick, colorMode]);

  // Update marker colors when colorMode changes
  useEffect(() => {
    if (!isLoaded) return;
    
    markersRef.current.forEach((data, id) => {
      const restaurant = restaurantsRef.current.find(r => r.id === id);
      if (restaurant) {
        const status = getMarkerStatus(restaurant, colorMode);
        data.innerElement.style.backgroundColor = colors[status];
      }
    });
  }, [colorMode, isLoaded]);

  // Update highlighted marker - separate effect, only runs when highlightedId changes
  // Scale the INNER element to avoid conflicting with Mapbox's positioning transform
  useEffect(() => {
    markersRef.current.forEach((data, id) => {
      const isHighlighted = highlightedId === id;
      if (isHighlighted) {
        // Scale the inner element, not the container (container uses Mapbox transforms for positioning)
        data.innerElement.style.transform = "scale(1.5)";
        data.innerElement.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
        // Bring highlighted marker to front via the container's z-index
        data.element.style.zIndex = "1000";
      } else {
        data.innerElement.style.transform = "scale(1)";
        data.innerElement.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
        data.element.style.zIndex = "1";
      }
    });
  }, [highlightedId]);

  // Fetch neighborhood boundaries on mount
  useEffect(() => {
    fetch(BOUNDARIES_URL)
      .then((res) => res.json())
      .then((data) => {
        boundariesRef.current = data;
      })
      .catch((err) => {
        console.warn("Failed to fetch neighborhood boundaries:", err);
      });
  }, []);

  // Render neighborhood boundary polygon
  useEffect(() => {
    if (!mapInstance.current || !isLoaded) return;

    const map = mapInstance.current;
    const sourceId = "neighborhood-boundary";
    const layerId = "neighborhood-fill";
    const outlineLayerId = "neighborhood-outline";

    // Remove existing layers and source
    if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    // If no neighborhood selected, don't add anything
    if (!selectedNeighborhoodSlug || !boundariesRef.current) return;

    // Find the matching neighborhood feature
    const feature = boundariesRef.current.features.find((f) => {
      const name = (f.properties?.pri_neigh || f.properties?.community || "").toLowerCase();
      const slug = name.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return slug === selectedNeighborhoodSlug;
    });

    if (!feature) return;

    // Create a FeatureCollection with just this feature
    const featureCollection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [feature],
    };

    // Add the source and layers
    map.addSource(sourceId, {
      type: "geojson",
      data: featureCollection,
    });

    map.addLayer({
      id: layerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#10b981",
        "fill-opacity": 0.15,
      },
    });

    map.addLayer({
      id: outlineLayerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#059669",
        "line-width": 3,
        "line-opacity": 0.8,
      },
    });
  }, [selectedNeighborhoodSlug, isLoaded]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className={className} style={{ background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "8px" }}>
        <p className="text-gray-500 font-medium">Map unavailable</p>
        <p className="text-gray-400 text-sm">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {!isLoaded && (
        <div style={{ position: "absolute", inset: 0, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, padding: "12px", textAlign: "center" }}>
          {loadError ? (
            <div className="text-gray-600 text-sm max-w-xs space-y-1">
              <p className="font-medium">Map failed to load</p>
              <p>{loadError}</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">Loading map...</p>
            </div>
          )}
        </div>
      )}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <style jsx global>{`
        .mapboxgl-marker {
          position: absolute;
          will-change: transform;
        }
        .mapboxgl-marker > div {
          position: relative;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

export const Map = forwardRef(MapComponent);
