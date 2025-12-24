"use client";

import { useState, useEffect } from "react";
import { MapPin, Building2, ChevronRight, Calendar, AlertTriangle, Clock } from "lucide-react";
import { ScoreStatusDisplayCompact } from "./ScoreStatusDisplay";
import Link from "next/link";

type ColorMode = "inspection" | "score";

interface MapRestaurantCardProps {
  restaurant: {
    id: string;
    slug: string;
    dba_name: string;
    address: string;
    cleanplate_score: number;
    latest_result: string;
    neighborhood?: string;
    latest_inspection_date?: string;
    violation_count?: number;
    risk_level?: number;
    facility_type?: string;
    // New AI-enhanced fields
    ai_summary?: string;
    violation_themes?: string[];
    critical_count?: number;
    inspection_type?: string;
  };
  isSelected?: boolean;
  isHovered?: boolean;
  onHover?: (id: string | null) => void;
  onClick?: () => void;
  colorMode?: ColorMode;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Facility type badges with emojis and colors
const facilityBadges: Record<string, { emoji: string; label: string; color: string }> = {
  "restaurant": { emoji: "🍽️", label: "Restaurant", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "grocery store": { emoji: "🛒", label: "Grocery", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "bakery": { emoji: "🧁", label: "Bakery", color: "bg-pink-50 text-pink-700 border-pink-200" },
  "coffee shop": { emoji: "☕", label: "Cafe", color: "bg-amber-50 text-amber-700 border-amber-200" },
  "bar": { emoji: "🍺", label: "Bar", color: "bg-purple-50 text-purple-700 border-purple-200" },
  "school": { emoji: "🏫", label: "School", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "hospital": { emoji: "🏥", label: "Hospital", color: "bg-red-50 text-red-700 border-red-200" },
  "daycare": { emoji: "👶", label: "Daycare", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  "catering": { emoji: "🍱", label: "Catering", color: "bg-orange-50 text-orange-700 border-orange-200" },
  "default": { emoji: "🏪", label: "Establishment", color: "bg-gray-50 text-gray-700 border-gray-200" },
};

function getFacilityBadge(facilityType?: string) {
  if (!facilityType) return facilityBadges.default;
  const key = facilityType.toLowerCase();
  return facilityBadges[key] || facilityBadges.default;
}

// Generate template summary (same logic as API)
function generateInspectionSummary(
  result: string,
  inspectionType: string | null,
  violationCount: number,
  criticalCount: number,
  themes: string[]
): string {
  const isPass = result.toLowerCase().includes("pass") && !result.toLowerCase().includes("fail");
  const isConditional = result.toLowerCase().includes("condition");
  
  let summary = "";
  
  if (isPass && violationCount === 0) {
    summary = "Clean inspection with no issues found.";
  } else if (isPass && criticalCount === 0 && violationCount <= 2) {
    summary = `Minor items noted but all standards met.`;
  } else if (isPass) {
    if (themes.length > 0) {
      summary = `Passed with notes on ${themes.slice(0, 2).map(t => t.split(" ")[1] || t).join(" & ")}.`;
    } else {
      summary = `${violationCount} items flagged but passed inspection.`;
    }
  } else if (isConditional) {
    if (criticalCount > 0) {
      summary = `Needs follow-up on ${criticalCount} critical item${criticalCount > 1 ? "s" : ""}`;
      if (themes.length > 0) summary += ` (${themes[0]})`;
      summary += ".";
    } else {
      summary = `Conditional: ${violationCount} issues require attention.`;
    }
  } else {
    // Failed
    if (themes.length > 0) {
      summary = `Failed due to ${themes.slice(0, 2).map(t => t.split(" ")[1] || t).join(", ")} concerns.`;
    } else {
      summary = `Did not pass: ${violationCount} violation${violationCount > 1 ? "s" : ""} found.`;
    }
  }
  
  // Add inspection type context
  if (inspectionType) {
    const type = inspectionType.toLowerCase();
    if (type.includes("complaint")) {
      summary += " (Complaint-driven inspection)";
    } else if (type.includes("re-inspection")) {
      summary += " (Follow-up visit)";
    }
  }
  
  return summary;
}

export function MapRestaurantCard({
  restaurant,
  isSelected = false,
  isHovered = false,
  onHover,
  onClick,
  colorMode = "inspection",
}: MapRestaurantCardProps) {
  // State for summary display
  const [displaySummary, setDisplaySummary] = useState<string | null>(restaurant.ai_summary || null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  // Generate template summary for fallback
  const templateSummary = generateInspectionSummary(
    restaurant.latest_result,
    restaurant.inspection_type || null,
    restaurant.violation_count || 0,
    restaurant.critical_count || 0,
    restaurant.violation_themes || []
  );
  
  // When card is expanded, fetch AI summary if inspection has been updated
  useEffect(() => {
    if (!isSelected || !restaurant.slug) return;
    
    // If we already have an AI summary from props, use it (it's already validated by API)
    if (restaurant.ai_summary) {
      setDisplaySummary(restaurant.ai_summary);
      return;
    }
    
    // Otherwise, fetch from summary endpoint (will generate if inspection updated)
    setIsLoadingSummary(true);
    fetch(`/api/establishments/${restaurant.slug}/summary`)
      .then((res) => res.json())
      .then((data) => {
        if (data.summary) {
          setDisplaySummary(data.summary);
        } else {
          // Fallback to template if no summary returned
          setDisplaySummary(templateSummary);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch AI summary:", error);
        setDisplaySummary(templateSummary);
      })
      .finally(() => {
        setIsLoadingSummary(false);
      });
  }, [isSelected, restaurant.slug, restaurant.ai_summary, templateSummary]);
  
  // Determine status based on colorMode - includes exceptional tier for 90+ scores and closed for out of business
  const getStatus = (): "closed" | "exceptional" | "pass" | "conditional" | "fail" => {
    // Always check for out of business first
    const result = restaurant.latest_result.toLowerCase();
    if (result.includes("out of business")) return "closed";
    
    if (colorMode === "score") {
      // Color by CleanPlate Score - 4 tiers
      if (restaurant.cleanplate_score >= 90) return "exceptional";
      if (restaurant.cleanplate_score >= 80) return "pass";
      if (restaurant.cleanplate_score >= 60) return "conditional";
      return "fail";
    } else {
      // Color by Inspection Result - no exceptional tier
      if (result.includes("fail")) return "fail";
      if (result.includes("condition")) return "conditional";
      return "pass";
    }
  };
  const status = getStatus();

  const statusColors: Record<string, string> = {
    closed: "border-gray-300 bg-gray-50",
    exceptional: "border-teal-300 bg-teal-50",
    pass: "border-emerald-300 bg-emerald-50",
    conditional: "border-amber-300 bg-amber-50",
    fail: "border-red-300 bg-red-50",
  };

  const buttonColors: Record<string, string> = {
    closed: "bg-gray-400 hover:bg-gray-500",
    exceptional: "bg-teal-400 hover:bg-teal-500",
    pass: "bg-emerald-400 hover:bg-emerald-500",
    conditional: "bg-amber-300 hover:bg-amber-400",
    fail: "bg-red-400 hover:bg-red-500",
  };

  return (
    <div
      onMouseEnter={() => onHover?.(restaurant.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`rounded-xl border-2 transition-all overflow-hidden touch-pan-y ${
        isSelected
          ? `${statusColors[status]} shadow-lg`
          : isHovered
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Main Card Content - Only clickable when not expanded */}
      <div 
        onClick={!isSelected ? onClick : undefined}
        className={`p-3 ${!isSelected ? 'cursor-pointer' : ''}`}
      >
        <div className="flex flex-col gap-2">
          {/* Score + Status Display */}
          <div className="flex items-center justify-between gap-2">
            <ScoreStatusDisplayCompact 
              score={restaurant.cleanplate_score} 
              latestResult={restaurant.latest_result}
              latestInspectionDate={restaurant.latest_inspection_date}
            />
            {/* Facility Badge */}
            {(() => {
              const badge = getFacilityBadge(restaurant.facility_type);
              return (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${badge.color} flex-shrink-0`}>
                  <span>{badge.emoji}</span>
                  {badge.label}
                </span>
              );
            })()}
          </div>

          {/* Restaurant Name & Address */}
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-1 mb-0.5">
              {restaurant.dba_name}
            </h4>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="line-clamp-1">{restaurant.address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details - Only when selected */}
      {isSelected && (
        <div 
          className="border-t border-gray-200 bg-white animate-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
          onTouchMove={(e) => {
            // Allow touch scrolling to work on parent
            e.stopPropagation();
          }}
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50">
            {/* Last Inspected */}
            <div className="text-center">
              <Calendar className="w-4 h-4 mx-auto text-gray-400 mb-1" />
              <p className="text-xs font-medium text-gray-900">
                {restaurant.latest_inspection_date 
                  ? formatDate(restaurant.latest_inspection_date)
                  : "--"}
              </p>
              <p className="text-[10px] text-gray-500">Inspected</p>
            </div>
            
            {/* Violations */}
            <div className="text-center">
              <AlertTriangle className="w-4 h-4 mx-auto text-gray-400 mb-1" />
              <p className={`text-xs font-medium ${
                (restaurant.violation_count ?? 0) > 5 ? "text-red-600" : 
                (restaurant.violation_count ?? 0) > 0 ? "text-amber-600" : "text-emerald-600"
              }`}>
                {restaurant.violation_count ?? 0}
              </p>
              <p className="text-[10px] text-gray-500">Violations</p>
            </div>
            
            {/* Category */}
            <div className="text-center">
              <Clock className="w-4 h-4 mx-auto text-gray-400 mb-1" />
              <p className="text-xs font-medium text-gray-900">
                {restaurant.latest_inspection_date 
                  ? getTimeAgo(restaurant.latest_inspection_date)
                  : "--"}
              </p>
              <p className="text-[10px] text-gray-500">Ago</p>
            </div>
          </div>

          {/* AI Summary & Violation Themes */}
          <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white border-t border-gray-100 space-y-2">
            {/* Summary Display with fade effect */}
            {isLoadingSummary ? (
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
              </div>
            ) : (
              <div className="relative">
                <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                  {displaySummary || templateSummary}
                </p>
                {/* Fade overlay to create mystery */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
              </div>
            )}
            
            {/* Violation Theme Pills */}
            {restaurant.violation_themes && restaurant.violation_themes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {restaurant.violation_themes.map((theme, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
            
            {/* Location */}
            {restaurant.neighborhood && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {restaurant.neighborhood}
              </p>
            )}
          </div>

          {/* View Details Button */}
          <div className="px-3 pb-3">
            {restaurant.slug && restaurant.slug.trim() ? (
              <Link
                href={`/restaurant/${restaurant.slug.trim()}`}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className={`flex items-center justify-center gap-2 w-full py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${buttonColors[status]}`}
              >
                View Full Details
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.error("Cannot navigate: restaurant missing slug", restaurant);
                }}
                disabled
                className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed"
              >
                Details unavailable
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

