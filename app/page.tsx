"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RestaurantCard } from "@/components/RestaurantCard";
import { RestaurantCardSkeleton } from "@/components/RestaurantCardSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { 
  UtensilsCrossed, 
  ShoppingBag, 
  Coffee, 
  Cake, 
  Beer, 
  Store,
  Search,
  MapPin,
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { Button, Card, CardBody, Chip } from "@heroui/react";

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

interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  pass_rate: number;
}

const categories = [
  { icon: UtensilsCrossed, label: "Dine-in", emoji: "🍽️", type: "Restaurant", href: "/search?facility_type=Restaurant", color: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200" },
  { icon: ShoppingBag, label: "Takeout", emoji: "🥡", type: "Restaurant", href: "/search?facility_type=Restaurant", color: "bg-orange-50 hover:bg-orange-100 border-orange-200" },
  { icon: Store, label: "Grocery", emoji: "🛒", type: "Grocery Store", href: "/search?facility_type=Grocery Store", color: "bg-blue-50 hover:bg-blue-100 border-blue-200" },
  { icon: Cake, label: "Bakery", emoji: "🧁", type: "Bakery", href: "/search?facility_type=Bakery", color: "bg-pink-50 hover:bg-pink-100 border-pink-200" },
  { icon: Coffee, label: "Cafe", emoji: "☕", type: "Coffee Shop", href: "/search?facility_type=Coffee Shop", color: "bg-amber-50 hover:bg-amber-100 border-amber-200" },
  { icon: Beer, label: "Bar", emoji: "🍺", type: "Bar", href: "/search?facility_type=Bar", color: "bg-purple-50 hover:bg-purple-100 border-purple-200" },
];

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [recentFailures, setRecentFailures] = useState<Restaurant[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [isLoadingFailures, setIsLoadingFailures] = useState(true);
  const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(true);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  useEffect(() => {
    fetch("/api/recent-failures?limit=4")
      .then((res) => res.json())
      .then((data) => {
        setRecentFailures(data.data || []);
        setIsLoadingFailures(false);
      })
      .catch(() => setIsLoadingFailures(false));

    fetch("/api/neighborhoods?sort=pass_rate&limit=12")
      .then((res) => res.json())
      .then((data) => {
        setNeighborhoods(data.data || []);
        setIsLoadingNeighborhoods(false);
      })
      .catch(() => setIsLoadingNeighborhoods(false));
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLocationClick = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          router.push(`/map?lat=${position.coords.latitude}&lng=${position.coords.longitude}`);
          setIsLoadingLocation(false);
        },
        () => {
          router.push("/map");
          setIsLoadingLocation(false);
        }
      );
    } else {
      router.push("/map");
      setIsLoadingLocation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <h1 className="text-2xl font-bold text-emerald-700">CleanPlate</h1>
            </div>
            <a
              href="/about"
              className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors"
            >
              About
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section with Gradient */}
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-3">
              Is your restaurant clean?
            </h2>
            <p className="text-emerald-100 text-lg">
              Search health inspection scores for Chicago restaurants
            </p>
          </div>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search restaurants, neighborhoods..."
                  className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                />
                <button
                  onClick={handleLocationClick}
                  disabled={isLoadingLocation}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Use my location"
                >
                  <MapPin className={`w-5 h-5 ${isLoadingLocation ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
                </button>
              </div>
              <Button
                color="primary"
                size="lg"
                radius="full"
                className="font-semibold px-8 bg-emerald-600 hover:bg-emerald-700"
                onPress={handleSearch}
              >
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {categories.map((category) => (
              <button
                key={category.label}
                onClick={() => router.push(category.href)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${category.color}`}
              >
                <span className="text-2xl">{category.emoji}</span>
                <span className="text-sm font-medium text-gray-700">{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Recently Failed Section */}
      <section className="max-w-6xl mx-auto px-4 mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Recently Failed</h3>
            <p className="text-sm text-gray-500">Restaurants that failed their latest inspection</p>
          </div>
        </div>
        
        {isLoadingFailures ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <RestaurantCardSkeleton key={i} />
            ))}
          </div>
        ) : recentFailures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentFailures.map((restaurant) => (
              <RestaurantCard key={restaurant.slug} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-200">
            <CardBody className="py-12 text-center">
              <span className="text-4xl mb-3 block">✅</span>
              <p className="text-gray-500 font-medium">No recent failures - great news!</p>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Neighborhoods Section */}
      <section className="max-w-6xl mx-auto px-4 mt-10 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Explore Neighborhoods</h3>
            <p className="text-sm text-gray-500">Browse restaurants by Chicago neighborhood</p>
          </div>
        </div>
        
        {isLoadingNeighborhoods ? (
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
            ))}
          </div>
        ) : neighborhoods.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {neighborhoods.map((neighborhood) => (
              <Chip
                key={neighborhood.id}
                variant="flat"
                className="cursor-pointer px-4 py-2 h-auto bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all shadow-sm"
                onClick={() => router.push(`/neighborhood/${neighborhood.slug}`)}
              >
                <span className="font-medium text-gray-700">{neighborhood.name}</span>
                {neighborhood.pass_rate !== null && (
                  <span className="ml-2 text-xs text-emerald-600 font-semibold">
                    {neighborhood.pass_rate.toFixed(0)}%
                  </span>
                )}
              </Chip>
            ))}
            <Chip
              variant="bordered"
              className="cursor-pointer px-4 py-2 h-auto border-2 border-dashed border-gray-300 hover:border-emerald-400 transition-all"
              onClick={() => router.push("/neighborhoods")}
            >
              <span className="font-medium text-gray-500">View all 77 →</span>
            </Chip>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No neighborhood data available
          </p>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
