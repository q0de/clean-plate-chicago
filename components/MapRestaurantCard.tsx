"use client";

import { MapPin, Building2, ChevronRight, Calendar, AlertTriangle, Clock } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import Link from "next/link";

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

export function MapRestaurantCard({
  restaurant,
  isSelected = false,
  isHovered = false,
  onHover,
  onClick,
}: MapRestaurantCardProps) {
  const status = restaurant.latest_result.toLowerCase().includes("fail")
    ? "fail"
    : restaurant.latest_result.toLowerCase().includes("condition")
    ? "conditional"
    : "pass";

  const statusColors = {
    pass: "border-emerald-500 bg-emerald-50",
    conditional: "border-amber-500 bg-amber-50",
    fail: "border-red-500 bg-red-50",
  };

  const buttonColors = {
    pass: "bg-emerald-600 hover:bg-emerald-700",
    conditional: "bg-amber-500 hover:bg-amber-600",
    fail: "bg-red-500 hover:bg-red-600",
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onHover?.(restaurant.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`rounded-xl border-2 cursor-pointer transition-all overflow-hidden ${
        isSelected
          ? `${statusColors[status]} shadow-lg`
          : isHovered
          ? "border-emerald-300 bg-emerald-50/50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Main Card Content */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Score Circle */}
          <div className="flex-shrink-0">
            <ScoreDisplay score={restaurant.cleanplate_score} size="sm" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Status + Facility Badge */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={status} size="sm" />
              {(() => {
                const badge = getFacilityBadge(restaurant.facility_type);
                return (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${badge.color}`}>
                    <span>{badge.emoji}</span>
                    {badge.label}
                  </span>
                );
              })()}
            </div>
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-1 mb-1">
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
        <div className="border-t border-gray-200 bg-white animate-in slide-in-from-top-2 duration-200">
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
            {/* AI Summary */}
            {restaurant.ai_summary ? (
              <p className="text-xs text-gray-700 leading-relaxed">
                {restaurant.ai_summary}
              </p>
            ) : (
              <p className="text-xs text-gray-500 italic">
                No detailed summary available
              </p>
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
            <Link
              href={`/restaurant/${restaurant.slug}`}
              onClick={(e) => e.stopPropagation()}
              className={`flex items-center justify-center gap-2 w-full py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${buttonColors[status]}`}
            >
              View Full Details
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

