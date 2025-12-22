"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScoreStatusDisplay } from "@/components/ScoreStatusDisplay";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { InspectionTimeline, TimelineInspection } from "@/components/InspectionTimeline";
import { Map as MapComponent } from "@/components/Map";
import { BottomNav } from "@/components/BottomNav";
import { Share2, MapPin, ExternalLink, ChevronLeft, Clock, AlertTriangle, Building2, TrendingUp, TrendingDown, History, Sparkles, Trophy, Zap, ShieldCheck, ShieldAlert, Award, Star, Bug, Thermometer, Droplets, Sparkle, AlertCircle, Wrench, Utensils, FileText, Hand, Phone } from "lucide-react";
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

// Map violation theme strings to icons and colors (matching violation category badges)
function getThemeConfig(theme: string): {
  icon: typeof AlertTriangle;
  label: string;
  bgColor: string;
  textColor: string;
} {
  // Remove emoji from theme string (covers common emoji ranges including ⚠️, 🐭, 🌡️, etc.)
  const label = theme.replace(/^[\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}]+\s*/gu, '').trim();
  const lowerTheme = theme.toLowerCase();
  
  // Temperature control
  if (lowerTheme.includes('temperature')) {
    return { icon: Thermometer, label, bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Equipment
  if (lowerTheme.includes('equipment')) {
    return { icon: Wrench, label, bgColor: "bg-blue-100", textColor: "text-blue-700" };
  }
  
  // Cleanliness / Contamination
  if (lowerTheme.includes('cleanliness') || lowerTheme.includes('contamination')) {
    return { icon: Droplets, label, bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Storage
  if (lowerTheme.includes('storage')) {
    return { icon: Utensils, label, bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Pest issues
  if (lowerTheme.includes('pest')) {
    return { icon: Bug, label, bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Documentation
  if (lowerTheme.includes('documentation')) {
    return { icon: FileText, label, bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Handwashing
  if (lowerTheme.includes('handwash')) {
    return { icon: Hand, label, bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Food labeling
  if (lowerTheme.includes('labeling') || lowerTheme.includes('label')) {
    return { icon: Utensils, label, bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Chemical safety / Cross-contamination
  if (lowerTheme.includes('chemical') || lowerTheme.includes('cross-contamination')) {
    return { icon: AlertTriangle, label, bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Default
  return { icon: AlertTriangle, label, bgColor: "bg-gray-100", textColor: "text-gray-700" };
}

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
  
  // External business data (Yelp/Google)
  const [externalData, setExternalData] = useState<{
    imageUrl: string | null;
    phone: string | null;
    isOpenNow: boolean | null;
    yelpUrl: string | null;
  }>({ imageUrl: null, phone: null, isOpenNow: null, yelpUrl: null });
  const [isLoadingExternalData, setIsLoadingExternalData] = useState(true);
  
  // Badge computation based on inspection history
  interface Badge {
    icon: React.ReactNode;
    label: string;
    color: string;
    bgColor: string;
  }
  
  const computeBadges = (inspectionList: TimelineInspection[], currentStatus: "pass" | "conditional" | "fail" | "closed"): Badge[] => {
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
          bgColor: "bg-emerald-100"
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
          bgColor: "bg-red-100"
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
          bgColor: "bg-blue-100"
        });
      }
    }
    
    // ⚠️ Critical Issues - has critical violations in last 3 inspections
    if (hasCriticalViolations) {
      badges.push({
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        label: "Critical Violations",
        color: "text-red-700",
        bgColor: "bg-red-100"
      });
    }
    
    // Note: Violation-specific badges (Pest Issues, Temperature Issues, Cleanliness Concerns)
    // are NOT shown here - they only appear in the AI Summary section as violation theme badges
    
    // ✨ Spotless Record - no violations in last 3 inspections (only if currently passing)
    if (totalViolationCount === 0 && last3.length >= 2 && isCurrentlyPassing) {
      badges.push({
        icon: <Sparkle className="w-3.5 h-3.5" />,
        label: "Spotless Record",
        color: "text-violet-700",
        bgColor: "bg-gradient-to-r from-violet-100 to-fuchsia-100"
      });
    }
    
    // 🛡️ No Critical Issues - no critical violations in last 3 and currently passing
    if (!hasCriticalViolations && consecutivePasses >= 2 && isCurrentlyPassing) {
      badges.push({
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
        label: "No Critical Issues",
        color: "text-emerald-700",
        bgColor: "bg-emerald-100"
      });
    }
    
    // ⭐ Bounce Back - recovered from failure (only if currently passing)
    if (last3.length >= 2 && isPassing(last3[0].results) && isFailing(last3[1].results) && isCurrentlyPassing) {
      badges.push({
        icon: <Star className="w-3.5 h-3.5" />,
        label: "Bounce Back",
        color: "text-purple-700",
        bgColor: "bg-purple-100"
      });
    }
    
    // 🔄 Ongoing Issues - same violation codes appearing in 2+ of the last 3 inspections
    if (last3.length >= 2 && allRecentViolations.length > 0) {
      // Group violations by code across all inspections
      const violationCodeCounts = new Map<string, number>();
      last3.forEach(insp => {
        const codes = new Set<string>();
        insp.violations?.forEach(v => {
          codes.add(v.violation_code);
        });
        codes.forEach(code => {
          violationCodeCounts.set(code, (violationCodeCounts.get(code) || 0) + 1);
        });
      });
      
      // Check if any violation code appears in 2+ inspections
      const hasOngoingIssues = Array.from(violationCodeCounts.values()).some(count => count >= 2);
      
      if (hasOngoingIssues) {
        badges.push({
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          label: "Ongoing Issues",
          color: "text-red-700",
          bgColor: "bg-red-100"
        });
      }
    }
    
    // Limit to 4 most relevant badges
    return badges.slice(0, 4);
  };
  
  // Check if restaurant is out of business
  const isOutOfBusiness = restaurant.latest_result.toLowerCase().includes("out of business") ||
    restaurant.latest_result.toLowerCase().includes("business not located");
  
  // Determine status based on score thresholds (needed for badge computation)
  // Determine status based on inspection result first, then score
  const getStatus = (): "pass" | "conditional" | "fail" | "closed" => {
    const score = restaurant.cleanplate_score;
    const result = restaurant.latest_result.toLowerCase();
    
    // Out of business / closed
    if (result.includes("out of business") || result.includes("business not located")) return "closed";
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

  // Fetch external business data (Yelp/Google)
  useEffect(() => {
    const fetchExternalData = async () => {
      try {
        const params = new URLSearchParams({
          name: restaurant.dba_name,
          address: restaurant.address,
          extended: "true",
        });
        const res = await fetch(`/api/restaurant-image?${params}`);
        const data = await res.json();
        setExternalData({
          imageUrl: data.imageUrl || null,
          phone: data.phone || null,
          isOpenNow: data.isOpenNow ?? null,
          yelpUrl: data.yelpUrl || null,
        });
      } catch (error) {
        console.error("Failed to fetch external data:", error);
      } finally {
        setIsLoadingExternalData(false);
      }
    };
    fetchExternalData();
  }, [restaurant.dba_name, restaurant.address]);

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

  // Status label for display
  const statusLabel = status === 'pass' ? 'Passing' : 
    status === 'conditional' ? 'Conditional' : 
    status === 'closed' ? 'Permanently Closed' : 'Failed';
  const statusBadgeColor = status === 'pass' ? 'bg-emerald-500/20 text-emerald-700' : 
    status === 'conditional' ? 'bg-amber-500/20 text-amber-700' : 
    status === 'closed' ? 'bg-gray-500/20 text-gray-700' : 'bg-red-500/20 text-red-700';

  return (
    <div className="min-h-screen bg-[#f6f8f6] pb-24">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Back to Search</span>
        </button>
        <div className="hidden sm:flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="font-bold text-lg tracking-tight">CleanPlate Chicago</span>
        </div>
        <button
          onClick={handleShare}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* Main Content - Two Column Layout */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 gap-8 grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Score Hero Section */}
          <section className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
              {/* Score Circle */}
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle 
                    className="fill-none stroke-gray-100" 
                    cx="50" cy="50" r="45" 
                    strokeWidth="8"
                  />
                  <circle 
                    className={`fill-none ${
                      status === 'fail' ? 'stroke-red-500' : 
                      status === 'conditional' ? 'stroke-amber-500' : 
                      status === 'closed' ? 'stroke-gray-400' :
                      'stroke-emerald-500'
                    }`}
                    cx="50" cy="50" r="45" 
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    strokeDashoffset={283 - (restaurant.cleanplate_score / 100) * 283}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black tracking-tighter">{restaurant.cleanplate_score}</span>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Score</span>
                </div>
              </div>

              {/* Status & Badges */}
              <div className="flex flex-col gap-4 text-center sm:text-left flex-grow">
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{statusLabel}</h1>
                    <span className={`${statusBadgeColor} px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide`}>
                      {isOutOfBusiness ? 'Out of Business' : 'Active License'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm sm:text-base">
                    {status === 'closed' ? 'This establishment is no longer in operation.' :
                     status === 'pass' ? 'Excellent compliance history.' : 
                     status === 'conditional' ? 'Some concerns noted.' : 
                     'Failed inspection.'} Last inspected {formatDistanceToNow(new Date(restaurant.latest_inspection_date), { addSuffix: true })}.
                  </p>
                </div>

                {/* Badges Grid */}
                {badges.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                    {badges.slice(0, 3).map((badge, index) => (
                      <div key={index} className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100`}>
                        <div className={`${badge.bgColor} p-1.5 rounded-md ${badge.color}`}>
                          {badge.icon}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold">{badge.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Summary Card - Dark Theme */}
          <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 sm:p-8 shadow-md text-white">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-sm font-bold uppercase tracking-widest">AI Inspection Summary</h2>
              </div>
              {isLoadingSummary ? (
                <div className="space-y-2">
                  <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
                </div>
              ) : aiSummary ? (
                <>
                  <p className="text-lg font-medium leading-relaxed max-w-2xl text-gray-100">
                    {aiSummary}
                  </p>
                  {violationThemes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {violationThemes.map((theme, index) => {
                        const themeConfig = getThemeConfig(theme);
                        const Icon = themeConfig.icon;
                        return (
                          <span
                            key={index}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${themeConfig.bgColor} ${themeConfig.textColor} flex items-center gap-1`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {themeConfig.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">Summary unavailable</p>
              )}
            </div>
          </section>

          {/* Score History Chart */}
          <section className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Score History</h3>
              <span className="text-sm text-gray-500">Last 12 Months</span>
            </div>
            {isLoadingInspections ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ScoreTrendChart inspections={inspections} />
            )}
          </section>

          {/* Inspection Timeline */}
          <section className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-6">Inspection Timeline</h3>
            {isLoadingInspections ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
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
        </div>

        {/* Right Column: Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Restaurant Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Restaurant Image */}
            <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300 relative overflow-hidden">
              {isLoadingExternalData ? (
                <div className="absolute inset-0 animate-pulse bg-gray-200" />
              ) : externalData.imageUrl ? (
                <img 
                  src={externalData.imageUrl} 
                  alt={restaurant.dba_name}
                  className="w-full h-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {/* Status Badge - prioritize official "Out of Business" over Yelp hours */}
              <div className="absolute bottom-4 left-4">
                {isOutOfBusiness ? (
                  <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">
                    Permanently Closed
                  </span>
                ) : externalData.isOpenNow !== null ? (
                  <span className={`${
                    externalData.isOpenNow 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gray-700 text-gray-200'
                  } text-xs font-bold px-2 py-1 rounded`}>
                    {externalData.isOpenNow ? 'Open Now' : 'Closed'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-black tracking-tight mb-1">{restaurant.dba_name}</h2>
              {restaurant.aka_name && (
                <p className="text-gray-500 text-sm mb-4">Also known as: {restaurant.aka_name}</p>
              )}
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{restaurant.address}</p>
                    <p className="text-gray-500 text-sm">{restaurant.city}, {restaurant.state} {restaurant.zip}</p>
                  </div>
                </div>
                {restaurant.neighborhood && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <button 
                      onClick={() => router.push(`/neighborhood/${restaurant.neighborhood!.slug}`)}
                      className="text-sm font-bold text-emerald-600 hover:underline"
                    >
                      {restaurant.neighborhood.name}
                    </button>
                  </div>
                )}
                {/* Phone Number from Yelp */}
                {externalData.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <a 
                      href={`tel:${externalData.phone.replace(/[^0-9+]/g, '')}`}
                      className="text-sm text-gray-600 hover:text-emerald-600"
                    >
                      {externalData.phone}
                    </a>
                  </div>
                )}
              </div>
              <button
                onClick={handleGetDirections}
                className={`w-full font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  isOutOfBusiness 
                    ? 'bg-gray-400 hover:bg-gray-500 text-white' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                <MapPin className="w-5 h-5" />
                {isOutOfBusiness ? 'View Former Location' : 'Get Directions'}
              </button>
            </div>
          </div>

          {/* Facility Details Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Facility Details</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Last Inspected</p>
                    <p className="font-bold">
                      {new Date(restaurant.latest_inspection_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    restaurant.risk_level === 1 ? 'bg-red-50 text-red-600' :
                    restaurant.risk_level === 2 ? 'bg-amber-50 text-amber-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Risk Category</p>
                    <p className="font-bold">Risk {restaurant.risk_level} ({riskLabels[restaurant.risk_level as keyof typeof riskLabels] || 'Unknown'})</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Facility Type</p>
                    <p className="font-bold">{restaurant.facility_type}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map Widget */}
          <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100 relative h-64 group">
            <MapComponent
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
              className="w-full h-full grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
            <div className="absolute bottom-4 left-4 right-4">
              <button 
                onClick={() => router.push(`/map?lat=${restaurant.latitude}&lng=${restaurant.longitude}`)}
                className="w-full bg-white text-gray-900 text-sm font-bold py-2 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
              >
                View Interactive Map
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">Data provided by City of Chicago Data Portal. Updated daily.</p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
