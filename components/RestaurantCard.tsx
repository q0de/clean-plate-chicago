"use client";

import { StatusBadge } from "./StatusBadge";
import { ScoreDisplay } from "./ScoreDisplay";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { MapPin, Clock, AlertTriangle } from "lucide-react";

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

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
}

export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const router = useRouter();
  
  // Determine status based on result AND score
  // Determine status based on inspection result first, then score
  const getStatus = () => {
    const result = restaurant.latest_result.toLowerCase();
    if (result.includes("fail")) return "fail";
    if (result.includes("condition")) return "conditional";
    // Only show as conditional if score is very low (< 60) despite passing
    if (restaurant.cleanplate_score < 60) return "conditional";
    return "pass";
  };
  const status = getStatus();
  
  const riskLabels = { 1: "High", 2: "Medium", 3: "Low" };
  const riskColors = { 1: "text-red-600", 2: "text-amber-600", 3: "text-green-600" };
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/restaurant/${restaurant.slug}`);
    }
  };
  
  return (
    <div 
      onClick={handlePress}
      className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-xl hover:border-emerald-200 transition-all duration-200 cursor-pointer overflow-hidden group"
    >
      {/* Status Banner */}
      <div className={`px-4 py-2 ${
        status === 'fail' ? 'bg-red-50' : 
        status === 'conditional' ? 'bg-amber-50' : 'bg-emerald-50'
      }`}>
        <div className="flex justify-between items-center">
          <StatusBadge status={status} size="sm" />
          <ScoreDisplay score={restaurant.cleanplate_score} size="sm" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-emerald-700 transition-colors">
          {restaurant.dba_name}
        </h3>
        
        {/* Address */}
        <div className="flex items-start gap-2 mb-3">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600 line-clamp-1">
            {restaurant.address}
            {restaurant.neighborhood && (
              <span className="text-gray-400"> · {restaurant.neighborhood}</span>
            )}
          </p>
        </div>
        
        {/* Inspection Date */}
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <p className="text-sm text-gray-500">
            Inspected {formatDistanceToNow(new Date(restaurant.latest_inspection_date), { addSuffix: true })}
          </p>
        </div>
        
        {/* Footer: Inspection Category */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {restaurant.risk_level && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">
                Category {restaurant.risk_level}
              </span>
            </div>
          )}
          {restaurant.violation_count !== undefined && restaurant.violation_count > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {restaurant.violation_count} violation{restaurant.violation_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
