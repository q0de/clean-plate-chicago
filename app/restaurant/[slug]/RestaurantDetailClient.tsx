"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { InspectionTimeline, TimelineInspection } from "@/components/InspectionTimeline";
import { Map } from "@/components/Map";
import { BottomNav } from "@/components/BottomNav";
import { Share2, MapPin, ExternalLink, ChevronLeft, Clock, AlertTriangle, Building2, TrendingUp, History, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Restaurant {
  id: string;
  slug: string;
  dba_name: string;
  aka_name?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  neighborhood?: { name: string; slug: string };
  cleanplate_score: number;
  latest_result: string;
  latest_inspection_date: string;
  facility_type: string;
  risk_level: number;
  latitude: number;
  longitude: number;
}

interface RestaurantDetailClientProps {
  restaurant: Restaurant;
}

const INITIAL_INSPECTION_COUNT = 4; // 3 visible + 1 teaser
const LOAD_MORE_COUNT = 5;

export function RestaurantDetailClient({ restaurant }: RestaurantDetailClientProps) {
  const router = useRouter();
  const [inspections, setInspections] = useState<TimelineInspection[]>([]);
  const [isLoadingInspections, setIsLoadingInspections] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  // AI Summary state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [violationThemes, setViolationThemes] = useState<string[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Initial fetch - just 4 inspections (3 visible + 1 teaser)
  useEffect(() => {
    fetch(`/api/establishments/${restaurant.slug}/inspections?limit=${INITIAL_INSPECTION_COUNT}&offset=0`)
      .then((res) => res.json())
      .then((data) => {
        setInspections(data.data || []);
        setHasMore(data.meta?.has_more ?? (data.data?.length === INITIAL_INSPECTION_COUNT));
        setOffset(data.data?.length || 0);
        setIsLoadingInspections(false);
      })
      .catch(() => setIsLoadingInspections(false));
  }, [restaurant.slug]);

  // Fetch AI summary
  useEffect(() => {
    fetch(`/api/establishments/${restaurant.slug}/summary`)
      .then((res) => res.json())
      .then((data) => {
        setAiSummary(data.summary || null);
        setViolationThemes(data.themes || []);
        setIsLoadingSummary(false);
      })
      .catch(() => setIsLoadingSummary(false));
  }, [restaurant.slug]);

  // Load more handler - lazy loads additional inspections
  const handleLoadMore = async (): Promise<TimelineInspection[]> => {
    setIsLoadingMore(true);
    try {
      const res = await fetch(
        `/api/establishments/${restaurant.slug}/inspections?limit=${LOAD_MORE_COUNT}&offset=${offset}`
      );
      const data = await res.json();
      const newInspections = data.data || [];
      
      setInspections(prev => [...prev, ...newInspections]);
      setHasMore(data.meta?.has_more ?? (newInspections.length === LOAD_MORE_COUNT));
      setOffset(prev => prev + newInspections.length);
      
      return newInspections;
    } catch (error) {
      console.error("Failed to load more inspections:", error);
      return [];
    } finally {
      setIsLoadingMore(false);
    }
  };

  const status = restaurant.latest_result.toLowerCase().includes("fail")
    ? "fail"
    : restaurant.latest_result.toLowerCase().includes("condition")
    ? "conditional"
    : "pass";

  const riskLabels = { 1: "High", 2: "Medium", 3: "Low" };
  const riskColors = { 1: "text-red-600 bg-red-50", 2: "text-amber-600 bg-amber-50", 3: "text-emerald-600 bg-emerald-50" };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurant.dba_name} - CleanPlate Score: ${restaurant.cleanplate_score}`,
          text: `Check out ${restaurant.dba_name}'s health inspection score on CleanPlate Chicago`,
          url: window.location.href,
        });
      } catch {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleGetDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-600 hover:text-emerald-600 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={handleShare}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Share"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Score Hero Section */}
      <section className={`${
        status === 'fail' ? 'bg-gradient-to-br from-red-50 to-red-100' : 
        status === 'conditional' ? 'bg-gradient-to-br from-amber-50 to-amber-100' : 
        'bg-gradient-to-br from-emerald-50 to-emerald-100'
      }`}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center">
            <StatusBadge status={status} size="lg" />
            <div className="my-6">
              <ScoreDisplay score={restaurant.cleanplate_score} size="lg" showLabel />
            </div>
          </div>
        </div>
      </section>

      {/* Restaurant Info Card */}
      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{restaurant.dba_name}</h1>
          {restaurant.aka_name && (
            <p className="text-gray-500 text-sm mb-3">Also known as: {restaurant.aka_name}</p>
          )}
          
          {/* Address */}
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-700">
                {restaurant.address}
                {restaurant.zip && `, ${restaurant.zip}`}
              </p>
              {restaurant.neighborhood && (
                <button 
                  onClick={() => router.push(`/neighborhood/${restaurant.neighborhood!.slug}`)}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                >
                  {restaurant.neighborhood.name} →
                </button>
              )}
            </div>
          </div>
          
          <button
            onClick={handleGetDirections}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            <MapPin className="w-5 h-5" />
            Get Directions
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {/* AI Summary Card */}
        <div className={`mt-4 rounded-2xl p-5 shadow-sm border ${
          status === 'fail' ? 'bg-red-50 border-red-200' : 
          status === 'conditional' ? 'bg-amber-50 border-amber-200' : 
          'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              status === 'fail' ? 'bg-red-100' : 
              status === 'conditional' ? 'bg-amber-100' : 
              'bg-emerald-100'
            }`}>
              <Sparkles className={`w-5 h-5 ${
                status === 'fail' ? 'text-red-600' : 
                status === 'conditional' ? 'text-amber-600' : 
                'text-emerald-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold text-sm mb-1 ${
                status === 'fail' ? 'text-red-900' : 
                status === 'conditional' ? 'text-amber-900' : 
                'text-emerald-900'
              }`}>
                AI Inspection Summary
              </h3>
              {isLoadingSummary ? (
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200/50 rounded animate-pulse w-full" />
                  <div className="h-4 bg-gray-200/50 rounded animate-pulse w-3/4" />
                </div>
              ) : aiSummary ? (
                <>
                  <p className={`text-sm leading-relaxed ${
                    status === 'fail' ? 'text-red-800' : 
                    status === 'conditional' ? 'text-amber-800' : 
                    'text-emerald-800'
                  }`}>
                    {aiSummary}
                  </p>
                  {violationThemes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {violationThemes.map((theme, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'fail' ? 'bg-red-100 text-red-700' : 
                            status === 'conditional' ? 'bg-amber-100 text-amber-700' : 
                            'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">Summary unavailable</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Last Inspected */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Inspected</span>
            </div>
            <p className="font-semibold text-gray-900">
              {new Date(restaurant.latest_inspection_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(restaurant.latest_inspection_date), { addSuffix: true })}
            </p>
          </div>
          
          {/* Inspection Category */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inspection Category</span>
            </div>
            <p className="font-semibold inline-flex px-2 py-1 rounded-lg text-sm bg-gray-100 text-gray-700">
              Level {restaurant.risk_level}
            </p>
          </div>
          
          {/* Facility Type */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Facility Type</span>
            </div>
            <p className="font-semibold text-gray-900">{restaurant.facility_type}</p>
          </div>
        </div>
      </div>

      {/* Score Trend Chart */}
      <section className="max-w-4xl mx-auto px-4 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Score History</h2>
            <p className="text-sm text-gray-500">Track performance over time</p>
          </div>
        </div>
        
        {isLoadingInspections ? (
          <div className="h-64 bg-white rounded-xl animate-pulse border border-gray-100" />
        ) : (
          <ScoreTrendChart inspections={inspections} />
        )}
      </section>

      {/* Inspection Timeline */}
      <section className="max-w-4xl mx-auto px-4 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <History className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Inspection Timeline</h2>
            <p className="text-sm text-gray-500">Complete inspection history with violations</p>
          </div>
        </div>
        
        {isLoadingInspections ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : (
          <InspectionTimeline 
            inspections={inspections}
            initialCount={3}
            loadMoreCount={LOAD_MORE_COUNT}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
          />
        )}
      </section>

      {/* Location Map */}
      <section className="max-w-4xl mx-auto px-4 mt-8 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-pink-100 rounded-lg">
            <span className="text-lg">📍</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Location</h2>
            <p className="text-sm text-gray-500">View on map</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <Map
            restaurants={[{
              id: restaurant.id,
              slug: restaurant.slug,
              dba_name: restaurant.dba_name,
              address: restaurant.address,
              cleanplate_score: restaurant.cleanplate_score,
              latest_result: restaurant.latest_result,
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            }]}
            center={[restaurant.longitude, restaurant.latitude]}
            zoom={15}
            className="w-full h-72"
          />
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
