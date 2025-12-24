"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Check, AlertTriangle, X, MapPin } from "lucide-react";
import { Button } from "@heroui/react";
import { Map } from "@/components/Map";
import { MapRestaurant } from "@/lib/types";

export function MapPromotion() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<MapRestaurant[]>([]);
  const [isLoadingMap, setIsLoadingMap] = useState(true);

  // Fetch sample restaurants for map preview (Chicago Loop area)
  useEffect(() => {
    const fetchSampleRestaurants = async () => {
      try {
        const response = await fetch(
          `/api/nearby?lat=41.8781&lng=-87.6298&radius_miles=2&limit=50`
        );
        const data = await response.json();
        setRestaurants(data.data || []);
      } catch (error) {
        console.error("Failed to fetch sample restaurants:", error);
      } finally {
        setIsLoadingMap(false);
      }
    };

    fetchSampleRestaurants();
  }, []);

  const legendItems = [
    {
      icon: Check,
      bgColor: "bg-[#dcfce7]",
      iconColor: "text-[#13EC5B]",
      label: "Green pins indicate passing scores (90+)",
    },
    {
      icon: AlertTriangle,
      bgColor: "bg-[#fef9c3]",
      iconColor: "text-[#CA8A04]",
      label: "Yellow pins indicate conditional passes",
    },
    {
      icon: X,
      bgColor: "bg-[#fee2e2]",
      iconColor: "text-[#DC2626]",
      label: "Red pins indicate failures or critical violations",
    },
  ];

  return (
    <section className="bg-[#f3f4f6] py-12 mt-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
          {/* Left Column - Text Content */}
          <div className="flex flex-col items-start justify-center w-full lg:w-[580px]">
            {/* Heading */}
            <h2 
              className="text-[30px] font-bold leading-[37.5px] tracking-[-0.45px] text-[#111813] mb-0"
              style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
            >
              Restaurant Hygiene Map
            </h2>

            {/* Description */}
            <div className="pt-6">
              <p 
                className="text-lg leading-[28px] text-[#4b5563] mb-0"
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                Visualize health scores across the city. Spot clusters of highly-rated
              </p>
              <p 
                className="text-lg leading-[28px] text-[#4b5563] mb-0"
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                venues in your favorite neighborhoods or identify areas with frequent
              </p>
              <p 
                className="text-lg leading-[28px] text-[#4b5563] mb-0"
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
              >
                violations before you book a table.
              </p>
            </div>

            {/* Legend Items */}
            <div className="pt-6 flex flex-col gap-4 w-full">
              {legendItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div key={index} className="flex gap-3 items-center">
                    <div className={`${item.bgColor} rounded-full w-8 h-8 flex items-center justify-center shrink-0`}>
                      <IconComponent className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <p 
                      className="text-base font-medium leading-6 text-[#1f2937]"
                      style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                    >
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Button */}
            <div className="pt-6">
              <Button
                className="bg-[#0d1b12] text-white font-bold px-6 py-3 h-12 rounded-lg hover:opacity-90 transition-opacity"
                style={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '14px', letterSpacing: '0.21px' }}
                onPress={() => router.push("/map?lat=41.8781&lng=-87.6298&zoom=13")}
                startContent={
                  <div className="flex items-center justify-center">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                }
              >
                Explore Interactive Map
              </Button>
            </div>
          </div>

          {/* Right Column - Live Map Preview */}
          <div className="w-full lg:w-[588px] relative">
            <div className="bg-white border-4 border-white rounded-xl shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] overflow-hidden">
              {/* Live Map Preview */}
              <div className="h-[400px] bg-gray-100 relative overflow-hidden">
                {isLoadingMap ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                      <p className="text-gray-500 text-sm">Loading map...</p>
                    </div>
                  </div>
                ) : (
                  <Map
                    restaurants={restaurants}
                    center={[-87.6298, 41.8781]} // Chicago Loop
                    zoom={13}
                    className="w-full h-full"
                    onMarkerClick={(restaurant) => router.push(`/map?lat=${restaurant.latitude}&lng=${restaurant.longitude}&zoom=16&slug=${restaurant.slug}`)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

