"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScoreStatusDisplay, DisplayModeSelector } from "@/components/ScoreStatusDisplay";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { InspectionTimeline, TimelineInspection } from "@/components/InspectionTimeline";
import { Map } from "@/components/Map";
import { BottomNav } from "@/components/BottomNav";
import { Share2, MapPin, ExternalLink, ChevronLeft, Clock, AlertTriangle, Building2, TrendingUp, TrendingDown, History, Sparkles, Trophy, Zap, ShieldCheck, ShieldAlert, Award, Star, Bug, Thermometer, Droplets, Sparkle } from "lucide-react";
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
  
  // Badge computation based on inspection history
  interface Badge {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
  }
  
  const computeBadges = (inspectionList: TimelineInspection[], currentStatus: "pass" | "conditional" | "fail"): Badge[] => {
    if (inspectionList.length === 0) return [];
    
    const badges: Badge[] = [];
    const last5 = inspectionList.slice(0, 5);
    const last3 = inspectionList.slice(0, 3);
    
    // Use the actual displayed status to avoid confusing badges
    const isCurrentlyPassing = currentStatus === "pass";
    const isCurrentlyFailing = currentStatus === "fail";
    
    // Helper to check if result is a pass
    const isPassing = (result: string) => {
      const r = result.toLowerCase();
      return r.includes("pass") && !r.includes("fail");
    };
    
    // Helper to check if result is a fail
    const isFailing = (result: string) => {
      return result.toLowerCase().includes("fail");
    };
    
    // Check for critical violations in recent inspections
    const hasCriticalViolations = last3.some(insp => 
      insp.violations?.some(v => v.is_critical === true)
    );
    
    // Collect all violations from last 3 inspections for category analysis
    const allRecentViolations = last3.flatMap(insp => insp.violations || []);
    
    // Helper to check violation categories by code
    const getViolationCategory = (code: string) => {
      const codeNum = parseInt(code);
      if (codeNum >= 6 && codeNum <= 20) return "temperature";
      if (codeNum >= 21 && codeNum <= 31) return "contamination";
      if (codeNum === 38) return "pest";
      if (codeNum >= 39 && codeNum <= 42) return "chemical";
      return "other";
    };
    
    // Count violations by category
    const hasPestViolations = allRecentViolations.some(v => getViolationCategory(v.violation_code) === "pest");
    const hasTemperatureViolations = allRecentViolations.some(v => getViolationCategory(v.violation_code) === "temperature");
    const hasContaminationViolations = allRecentViolations.some(v => getViolationCategory(v.violation_code) === "contamination");
    const totalViolationCount = allRecentViolations.length;
    
    // Count consecutive passes from most recent
    let consecutivePasses = 0;
    for (const insp of inspectionList) {
      if (isPassing(insp.results)) {
        consecutivePasses++;
      } else {
        break;
      }
    }
    
    // 🏆 Clean Streak - 3+ consecutive passes (only show if currently passing)
    if (consecutivePasses >= 3 && isCurrentlyPassing) {
      badges.push({
        icon: <Trophy className="w-3.5 h-3.5" />,
        label: `${consecutivePasses}x Clean Streak`,
        color: "text-amber-700",
        bgColor: "bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200"
      });
    }
    
    // 📈 Improving - last 3 show improvement trend (only if not currently failing)
    if (last3.length >= 3 && !isCurrentlyFailing) {
      const results = last3.map(i => isPassing(i.results) ? 1 : 0);
      // Recent is better than older (e.g., [pass, pass, fail] or [pass, cond, fail])
      if (results[0] === 1 && results[2] === 0) {
        badges.push({
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          label: "Improving",
          color: "text-emerald-700",
          bgColor: "bg-emerald-100 border-emerald-200"
        });
      }
    }
    
    // 📉 Declining - was passing, now failing
    if (last3.length >= 2) {
      const results = last3.map(i => isPassing(i.results) ? 1 : 0);
      if (results[0] === 0 && results[results.length - 1] === 1) {
        badges.push({
          icon: <TrendingDown className="w-3.5 h-3.5" />,
          label: "Recent Decline",
          color: "text-red-700",
          bgColor: "bg-red-100 border-red-200"
        });
      }
    }
    
    // ⚡ Recently Inspected - within last 30 days
    if (inspectionList.length > 0) {
      const lastDate = new Date(inspectionList[0].inspection_date);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 30) {
        badges.push({
          icon: <Zap className="w-3.5 h-3.5" />,
          label: "Recently Inspected",
          color: "text-blue-700",
          bgColor: "bg-blue-100 border-blue-200"
        });
      }
    }
    
    // ⚠️ Critical Issues - has critical violations in last 3 inspections
    if (hasCriticalViolations) {
      badges.push({
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        label: "Critical Violations",
        color: "text-red-700",
        bgColor: "bg-red-100 border-red-200"
      });
    }
    
    // 🐀 Pest Issues - has pest/rodent violations in last 3 inspections
    if (hasPestViolations) {
      badges.push({
        icon: <Bug className="w-3.5 h-3.5" />,
        label: "Pest Issues",
        color: "text-orange-700",
        bgColor: "bg-orange-100 border-orange-200"
      });
    }
    
    // 🌡️ Temperature Issues - has food safety/temperature violations
    if (hasTemperatureViolations) {
      badges.push({
        icon: <Thermometer className="w-3.5 h-3.5" />,
        label: "Temperature Issues",
        color: "text-rose-700",
        bgColor: "bg-rose-100 border-rose-200"
      });
    }
    
    // 🧼 Cleanliness Concerns - has contamination violations
    if (hasContaminationViolations) {
      badges.push({
        icon: <Droplets className="w-3.5 h-3.5" />,
        label: "Cleanliness Concerns",
        color: "text-sky-700",
        bgColor: "bg-sky-100 border-sky-200"
      });
    }
    
    // ✨ Spotless Record - no violations in last 3 inspections (only if currently passing)
    if (totalViolationCount === 0 && last3.length >= 2 && isCurrentlyPassing) {
      badges.push({
        icon: <Sparkle className="w-3.5 h-3.5" />,
        label: "Spotless Record",
        color: "text-violet-700",
        bgColor: "bg-gradient-to-r from-violet-100 to-fuchsia-100 border-violet-200"
      });
    }
    
    // 🛡️ No Critical Issues - no critical violations in last 3 and currently passing
    if (!hasCriticalViolations && consecutivePasses >= 2 && isCurrentlyPassing) {
      badges.push({
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        label: "No Critical Issues",
        color: "text-emerald-700",
        bgColor: "bg-emerald-100 border-emerald-200"
      });
    }
    
    // ⭐ Bounce Back - recovered from failure (only if currently passing)
    if (last3.length >= 2 && isPassing(last3[0].results) && isFailing(last3[1].results) && isCurrentlyPassing) {
      badges.push({
        icon: <Star className="w-3.5 h-3.5" />,
        label: "Bounce Back",
        color: "text-purple-700",
        bgColor: "bg-purple-100 border-purple-200"
      });
    }
    
    // Limit to 4 most relevant badges
    return badges.slice(0, 4);
  };
  
  // Determine status based on score thresholds (needed for badge computation)
  // Determine status based on inspection result first, then score
  const getStatus = (): "pass" | "conditional" | "fail" => {
    const score = restaurant.cleanplate_score;
    const result = restaurant.latest_result.toLowerCase();
    
    // Explicit fail always shows as fail
    if (result.includes("fail")) return "fail";
    // Conditional pass shows as conditional
    if (result.includes("condition")) return "conditional";
    // Very low score (< 60) despite passing is concerning
    if (score < 60) return "conditional";
    // Passed with score >= 60 shows as pass
    return "pass";
  };
  const status = getStatus();
  
  const badges = useMemo(() => computeBadges(inspections, status), [inspections, status]);

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
          {/* Display Mode Selector - for testing */}
          <div className="flex justify-end mb-4">
            <DisplayModeSelector />
          </div>
          
          <div className="flex flex-col items-center">
            <ScoreStatusDisplay 
              score={restaurant.cleanplate_score} 
              latestResult={restaurant.latest_result} 
              size="lg" 
              showLabel 
            />
            
            {/* Achievement Badges based on inspection history */}
            {badges.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {badges.map((badge, index) => (
                  <div
                    key={index}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.bgColor} ${badge.color} shadow-sm`}
                  >
                    {badge.icon}
                    {badge.label}
                  </div>
                ))}
              </div>
            )}
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
