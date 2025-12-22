"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useCardDesign } from "@/lib/card-design-context";
import { NoiseTexture } from "@/components/NoiseTexture";
import { RestaurantCardSkeleton } from "@/components/RestaurantCardSkeleton";
import { BottomNav } from "@/components/BottomNav";
import { CardDesignControls } from "@/components/CardDesignControls";
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
  TrendingUp,
  Pizza,
  Fish
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
  critical_count?: number;
  risk_level?: number;
  raw_violations?: string;
  violation_themes?: string[];
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
  const { config } = useCardDesign();
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
    <div className="min-h-screen bg-[#F6F8F6] pb-20">
      {/* Logo at top of page */}
      <div 
        className="flex justify-center bg-[#F6F8F6]"
        style={{ paddingTop: `${config.headerPadding || 16}px`, paddingBottom: `${config.headerPadding || 16}px` }}
      >
        <img 
          src="/images/logo_5.webp" 
          alt="CleanPlate Chicago" 
          style={{ height: `${config.logoIconSize}px`, width: 'auto' }}
        />
      </div>

      {/* Hero Section */}
      <section className="px-4 sm:px-8 lg:px-12 pb-8">
        <div className="max-w-7xl mx-auto relative rounded-2xl overflow-hidden">
          {/* Background Image with subtle panning */}
          <div 
            className="absolute inset-0 bg-center bg-no-repeat bg-cover animate-hero-pan"
            style={{ backgroundImage: "url('/images/img_header.webp')" }}
          />
          {/* Dark Overlay for text readability */}
          <div className="absolute inset-0 bg-black/40" />
          
          {/* Animated Noise Overlay */}
          {config.heroNoiseEnabled && (
            <NoiseTexture 
              opacity={config.heroNoiseOpacity / 100}
              speed={Math.round(1 / config.heroNoiseSpeed * 30)}
              contrast={2.5}
              brightness={1.5}
            />
          )}
          
          {/* Watermark Logo - bottom right, cropped by edge */}
          <div 
            className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 pointer-events-none"
            style={{ opacity: config.heroWatermarkOpacity || 0.12 }}
          >
            <img 
              src="/images/logo_5.webp" 
              alt="" 
              style={{ width: `${config.heroWatermarkSize || 400}px`, height: 'auto' }}
            />
          </div>
          
          <div className="relative z-10 py-10 px-8 sm:px-12">
          {/* Live Updates Badge */}
          <div className="flex justify-center mb-6">
            <div className="bg-[rgba(19,236,91,0.2)] border border-[rgba(19,236,91,0.4)] flex gap-2 items-center px-[13px] py-[5px] rounded-full backdrop-blur-sm">
              <div className="bg-[#13EC5B] rounded-full w-2 h-2" />
              <span className="font-bold text-white text-xs leading-4 tracking-[0.6px] uppercase whitespace-nowrap" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                Live Updates
              </span>
            </div>
          </div>

          {/* Main Heading */}
          <div className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl lg:text-[59.8px] font-extrabold leading-tight sm:leading-[60px] tracking-[-1.5px] text-white mb-0" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              Eat Safe in{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#13EC5B] to-[#34d399]">
                Chicago
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <div className="text-center max-w-[672px] mx-auto mb-8">
            <p className="text-base sm:text-lg lg:text-[20px] leading-6 sm:leading-7 text-white/90 mb-0" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              Real-time health inspection scores for over 15,000 local restaurants.
            </p>
            <p className="text-base sm:text-lg lg:text-[20px] leading-6 sm:leading-7 text-white/90 mb-0" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
              Make informed decisions before you make a reservation.
            </p>
          </div>

          {/* Search Box */}
          <div className="max-w-[672px] mx-auto mb-10">
            <div className="bg-white rounded-xl shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] p-2 flex flex-col sm:flex-row gap-2 items-center">
              <div className="flex-1 flex items-center gap-3 px-4 py-3">
                <Search className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search by restaurant, cuisine, or neighborhood..."
                  className="flex-1 bg-transparent outline-none focus:outline-none focus:ring-0 text-[#0D1B12] placeholder-[#9CA3AF] text-lg"
                  style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                />
                <button
                  onClick={handleLocationClick}
                  disabled={isLoadingLocation}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
                  title="Use my location"
                >
                  <MapPin className={`w-5 h-5 ${isLoadingLocation ? 'text-[#13EC5B] animate-pulse' : 'text-[#9CA3AF]'}`} />
                </button>
              </div>
              <Button
                className="bg-[#13EC5B] hover:bg-[#10d955] text-[#0D1B12] font-bold px-10 py-3 h-auto rounded-lg transition-colors min-w-[120px] focus:outline-none"
                style={{ fontFamily: 'var(--font-manrope), sans-serif' }}
                onPress={handleSearch}
              >
                Find
              </Button>
            </div>
          </div>

          {/* Stats Section */}
          <div className="flex gap-8 sm:gap-12 lg:gap-16 items-start justify-center flex-wrap">
            <div className="flex flex-col items-center">
              <div className="text-2xl sm:text-3xl lg:text-[30px] font-extrabold leading-7 sm:leading-8 lg:leading-9 text-white mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                15k+
              </div>
              <div className="text-xs sm:text-sm font-medium leading-4 sm:leading-5 text-white/70" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                Restaurants
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl sm:text-3xl lg:text-[30px] font-extrabold leading-7 sm:leading-8 lg:leading-9 text-white mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                24h
              </div>
              <div className="text-xs sm:text-sm font-medium leading-4 sm:leading-5 text-white/70" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                Updated Daily
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-2xl sm:text-3xl lg:text-[30px] font-extrabold leading-7 sm:leading-8 lg:leading-9 text-white mb-1" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                100%
              </div>
              <div className="text-xs sm:text-sm font-medium leading-4 sm:leading-5 text-white/70" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                Official Data
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* Category Chips Navigation - After Stats, Before Trending */}
      <nav style={{ backgroundColor: config.chipsSectionBgColor }}>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 items-center justify-center overflow-x-auto py-[17px] scrollbar-hide">
            {[
              { label: "Burgers", icon: UtensilsCrossed },
              { label: "Pizza", icon: Pizza },
              { label: "Tacos", icon: UtensilsCrossed },
              { label: "Coffee", icon: Coffee },
              { label: "Fine Dining", icon: UtensilsCrossed },
              { label: "Sushi", icon: Fish },
            ].map((category) => (
              <button
                key={category.label}
                onClick={() => router.push(`/search?q=${encodeURIComponent(category.label)}`)}
                className="border border-transparent flex gap-2 items-center px-[17px] py-[7px] rounded-full shrink-0 hover:opacity-80 transition-all"
                style={{ backgroundColor: config.chipsBgColor }}
              >
                <category.icon className="w-5 h-5 text-[#0D1B12]" />
                <span className="font-bold text-[#0D1B12] text-sm leading-5 whitespace-nowrap" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
                  {category.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Trending Section */}
      <section className="max-w-6xl mx-auto px-4 mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Trending</h3>
            <p className="text-sm text-gray-500">Most recent inspections across Chicago</p>
          </div>
        </div>
        
        {isLoadingFailures ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0">
                <RestaurantCardSkeleton />
              </div>
            ))}
          </div>
        ) : recentFailures.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
            {recentFailures.map((restaurant) => (
              <div key={restaurant.slug} className="flex-shrink-0">
                <RestaurantCard restaurant={restaurant} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="bg-gray-50 border-2 border-dashed border-gray-200">
            <CardBody className="py-12 text-center">
              <span className="text-4xl mb-3 block">📊</span>
              <p className="text-gray-500 font-medium">No recent inspections found</p>
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
      <CardDesignControls />
    </div>
  );
}
