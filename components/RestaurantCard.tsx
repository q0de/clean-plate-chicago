"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  MapPin, 
  X, 
  AlertTriangle, 
  Check,
  XCircle,
  Thermometer,
  Bug,
  Skull,
  Utensils,
  Droplets,
  Waves,
  Hand,
  FileText
} from "lucide-react";
import { ScoreDisplay } from "./ScoreDisplay";
import { useCardDesign } from "@/lib/card-design-context";
import { useColorTheme } from "@/lib/color-theme-context";

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
  raw_violations?: string;
  violation_themes?: string[];
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
}

// Violation theme priority mapping (1 = highest priority)
const VIOLATION_PRIORITY: Record<string, number> = {
  "toxic": 1,
  "chemical safety": 1,
  "pest": 2,
  "pest control": 2,
  "pest issues": 2,  // From API themes
  "temperature": 3,
  "temperature control": 3,
  "food handling": 4,
  "cross contamination": 4,
  "cross-contamination": 4,
  "sanitation": 5,
  "cleanliness": 5,
  "water": 6,
  "sewage": 6,
  "plumbing": 6,
  "water/sewage": 6,  // Display label
  "hygiene": 7,
  "handwashing": 7,
  "hand wash": 7,
  "certification": 8,
  "documentation": 8,
  "equipment": 9,
  "storage": 10,
};

// Get violation theme config with icon and styling
function getViolationThemeConfig(theme: string, status: "fail" | "conditional" | "pass"): {
  icon: typeof AlertTriangle;
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  isAdministrative: boolean;
} {
  // Remove emoji if present
  const cleanTheme = theme.replace(/^[\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}]+\s*/gu, '').trim();
  const lowerTheme = cleanTheme.toLowerCase();
  
  // Administrative violations (Certification/Documentation)
  if (lowerTheme.includes('certification') || lowerTheme.includes('documentation')) {
    let bgColor = "bg-gray-100";
    let borderColor = "border-red-400";
    let textColor = "text-gray-700";
    if (status === "fail") {
      borderColor = "border-red-400";
      textColor = "text-red-700";
    } else if (status === "conditional") {
      borderColor = "border-amber-400";
      textColor = "text-amber-700";
    }
    return {
      icon: FileText,
      label: cleanTheme,
      bgColor,
      borderColor,
      textColor,
      isAdministrative: true,
    };
  }
  
  // Health-related violations
  let icon: typeof AlertTriangle = AlertTriangle;
  let label = cleanTheme;
  
  if (lowerTheme.includes('toxic') || lowerTheme.includes('chemical')) {
    icon = Skull;
    label = "Toxic";
  } else if (lowerTheme.includes('pest')) {
    icon = Bug;
    label = "Pest Infestation";
  } else if (lowerTheme.includes('temperature') || lowerTheme.includes('temp')) {
    icon = Thermometer;
    label = "Temp Control";
  } else if (lowerTheme.includes('food handling') || lowerTheme.includes('cross contamination') || lowerTheme.includes('cross-contamination')) {
    icon = Utensils;
    label = "Food Handling";
  } else if (lowerTheme.includes('sanitation') || lowerTheme.includes('cleanliness')) {
    icon = Droplets;
    label = "Sanitation";
  } else if (lowerTheme.includes('water') || lowerTheme.includes('sewage') || lowerTheme.includes('plumbing')) {
    icon = Waves;
    label = "Water/Sewage";
  } else if (lowerTheme.includes('hygiene') || lowerTheme.includes('handwash') || lowerTheme.includes('hand wash')) {
    icon = Hand;
    label = "Hygiene";
  }
  
  // Styling based on status
  if (status === "fail") {
    return {
      icon,
      label,
      bgColor: "bg-red-50",
      borderColor: "border-red-400",
      textColor: "text-red-700",
      isAdministrative: false,
    };
  } else if (status === "conditional") {
    return {
      icon,
      label,
      bgColor: "bg-amber-50",
      borderColor: "border-amber-400",
      textColor: "text-amber-700",
      isAdministrative: false,
    };
  }
  
  // Default (shouldn't show for pass, but just in case)
  return {
    icon,
    label,
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    textColor: "text-gray-700",
    isAdministrative: false,
  };
}

// Extract and prioritize violation themes
function getPrimaryViolationTheme(
  themes: string[] | undefined,
  rawViolations: string | undefined
): string | null {
  if (!themes || themes.length === 0) {
    // Try to extract from raw violations if themes not provided
    if (!rawViolations) return null;
    
    const lowerText = rawViolations.toLowerCase();
    const foundThemes: string[] = [];
    
    // Check for each violation type in priority order
    if (lowerText.includes('toxic') || lowerText.includes('chemical')) {
      foundThemes.push("toxic");
    }
    if (/\b(rodent|mouse|mice|rat|pest|insect|roach|fly|flies|droppings)\b/.test(lowerText)) {
      foundThemes.push("pest");
    }
    if (lowerText.includes('temperature') || lowerText.includes('cold holding') || lowerText.includes('hot holding')) {
      foundThemes.push("temperature");
    }
    if (lowerText.includes('cross contam') || lowerText.includes('raw meat')) {
      foundThemes.push("food handling");
    }
    if (/\b(clean|debris|soil|saniti|dirty)\b/.test(lowerText)) {
      foundThemes.push("sanitation");
    }
    // Only flag water issues for actual problems, not positive mentions like "running water"
    if (lowerText.includes('sewage') || lowerText.includes('no hot water') || lowerText.includes('no water') || 
        lowerText.includes('water leak') || lowerText.includes('plumbing') || lowerText.includes('wastewater')) {
      foundThemes.push("water");
    }
    if (lowerText.includes('handwash') || lowerText.includes('hand wash') || lowerText.includes('hygiene')) {
      foundThemes.push("hygiene");
    }
    if (lowerText.includes('certificate') || lowerText.includes('license') || lowerText.includes('permit') || lowerText.includes('documentation')) {
      foundThemes.push("certification");
    }
    
    if (foundThemes.length === 0) return null;
    
    // Sort by priority and return first
    foundThemes.sort((a, b) => {
      const priorityA = VIOLATION_PRIORITY[a] || 999;
      const priorityB = VIOLATION_PRIORITY[b] || 999;
      return priorityA - priorityB;
    });
    
    return foundThemes[0];
  }
  
  // Sort themes by priority
  const sortedThemes = [...themes].sort((a, b) => {
    const cleanA = a.replace(/^[\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}]+\s*/gu, '').trim().toLowerCase();
    const cleanB = b.replace(/^[\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}]+\s*/gu, '').trim().toLowerCase();
    
    const priorityA = VIOLATION_PRIORITY[cleanA] || 999;
    const priorityB = VIOLATION_PRIORITY[cleanB] || 999;
    
    return priorityA - priorityB;
  });
  
  return sortedThemes[0] || null;
}

// Get score color based on score value - 4 tiers including exceptional (90+)
function getScoreColor(score: number): string {
  if (score >= 90) return "#14b8a6"; // teal-500 (exceptional green-blue)
  if (score >= 80) return "#10b981"; // emerald-500
  if (score >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

export function RestaurantCard({ restaurant, onPress }: RestaurantCardProps) {
  const router = useRouter();
  const { config } = useCardDesign();
  const { colors: themeColors } = useColorTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  
  // Fetch restaurant image from Yelp
  useEffect(() => {
    const fetchImage = async () => {
      try {
        const params = new URLSearchParams({
          name: restaurant.dba_name,
          address: restaurant.address,
        });
        const response = await fetch(`/api/restaurant-image?${params}`);
        const data = await response.json();
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
        }
      } catch (error) {
        console.error("Failed to fetch restaurant image:", error);
      } finally {
        setImageLoading(false);
      }
    };
    
    fetchImage();
  }, [restaurant.dba_name, restaurant.address]);
  
  // Determine status based on inspection result
  const getStatus = (): "fail" | "conditional" | "pass" | "closed" => {
    const result = restaurant.latest_result.toLowerCase();
    if (result.includes("out of business")) return "closed";
    if (result.includes("fail")) return "fail";
    if (result.includes("condition")) return "conditional";
    return "pass";
  };
  
  const status = getStatus();
  const inspectionDate = new Date(restaurant.latest_inspection_date);
  const formattedDate = format(inspectionDate, "MMM d, yyyy");
  
  // Get primary violation theme
  const primaryTheme = getPrimaryViolationTheme(
    restaurant.violation_themes,
    restaurant.raw_violations
  );
  
  const violationConfig = primaryTheme 
    ? getViolationThemeConfig(primaryTheme, status)
    : null;
  
  // Count additional themes - need to count all themes, not just from violation_themes array
  let additionalThemesCount = 0;
  if (restaurant.violation_themes && restaurant.violation_themes.length > 1) {
    additionalThemesCount = restaurant.violation_themes.length - 1;
  } else if (restaurant.raw_violations && primaryTheme) {
    // If we extracted from raw_violations, try to count additional themes
    const lowerText = restaurant.raw_violations.toLowerCase();
    const foundThemes: string[] = [];
    
    if (lowerText.includes('toxic') || lowerText.includes('chemical')) foundThemes.push("toxic");
    if (/\b(rodent|mouse|mice|rat|pest|insect|roach|fly|flies|droppings)\b/.test(lowerText)) foundThemes.push("pest");
    if (lowerText.includes('temperature') || lowerText.includes('cold holding') || lowerText.includes('hot holding')) foundThemes.push("temperature");
    if (lowerText.includes('cross contam') || lowerText.includes('raw meat')) foundThemes.push("food handling");
    if (/\b(clean|debris|soil|saniti|dirty)\b/.test(lowerText)) foundThemes.push("sanitation");
    // Only flag water issues for actual problems, not positive mentions
    if (lowerText.includes('sewage') || lowerText.includes('no hot water') || lowerText.includes('no water') || 
        lowerText.includes('water leak') || lowerText.includes('plumbing') || lowerText.includes('wastewater')) foundThemes.push("water");
    if (lowerText.includes('handwash') || lowerText.includes('hand wash') || lowerText.includes('hygiene')) foundThemes.push("hygiene");
    if (lowerText.includes('certificate') || lowerText.includes('license') || lowerText.includes('permit') || lowerText.includes('documentation')) foundThemes.push("certification");
    
    additionalThemesCount = Math.max(0, foundThemes.length - 1);
  }
  
  // Format restaurant name to title case
  const formatTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  const formattedRestaurantName = formatTitleCase(restaurant.dba_name);
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (!restaurant.slug) {
        console.error("RestaurantCard: slug is missing for restaurant:", restaurant.dba_name);
        return;
      }
      router.push(`/restaurant/${restaurant.slug}`);
    }
  };
  
  // Status banner config with custom SVG icons - using theme colors
  const statusConfig = {
    fail: {
      bgColor: themeColors.fail.bg,
      textColor: themeColors.fail.text,
      iconSvg: (
        <svg xmlns="http://www.w3.org/2000/svg" width={config.statusIconSize} height={config.statusIconSize} viewBox="0 0 20 24" fill="none" className="flex-shrink-0">
          <path d="M6.99935 16.1666L9.99935 13.1666L12.9994 16.1666L14.166 14.9999L11.166 11.9999L14.166 8.99992L12.9994 7.83325L9.99935 10.8333L6.99935 7.83325L5.83268 8.99992L8.83268 11.9999L5.83268 14.9999L6.99935 16.1666ZM9.99935 20.3333C8.84657 20.3333 7.76324 20.1145 6.74935 19.677C5.73546 19.2395 4.85352 18.6458 4.10352 17.8958C3.35352 17.1458 2.75977 16.2638 2.32227 15.2499C1.88477 14.236 1.66602 13.1527 1.66602 11.9999C1.66602 10.8471 1.88477 9.76381 2.32227 8.74992C2.75977 7.73603 3.35352 6.85408 4.10352 6.10408C4.85352 5.35408 5.73546 4.76033 6.74935 4.32283C7.76324 3.88533 8.84657 3.66658 9.99935 3.66658C11.1521 3.66658 12.2355 3.88533 13.2494 4.32283C14.2632 4.76033 15.1452 5.35408 15.8952 6.10408C16.6452 6.85408 17.2389 7.73603 17.6764 8.74992C18.1139 9.76381 18.3327 10.8471 18.3327 11.9999C18.3327 13.1527 18.1139 14.236 17.6764 15.2499C17.2389 16.2638 16.6452 17.1458 15.8952 17.8958C15.1452 18.6458 14.2632 19.2395 13.2494 19.677C12.2355 20.1145 11.1521 20.3333 9.99935 20.3333ZM9.99935 18.6666C11.8605 18.6666 13.4369 18.0208 14.7285 16.7291C16.0202 15.4374 16.666 13.861 16.666 11.9999C16.666 10.1388 16.0202 8.56242 14.7285 7.27075C13.4369 5.97908 11.8605 5.33325 9.99935 5.33325C8.13824 5.33325 6.56185 5.97908 5.27018 7.27075C3.97852 8.56242 3.33268 10.1388 3.33268 11.9999C3.33268 13.861 3.97852 15.4374 5.27018 16.7291C6.56185 18.0208 8.13824 18.6666 9.99935 18.6666Z" fill="currentColor"/>
        </svg>
      ),
      label: "FAILED",
    },
    conditional: {
      bgColor: themeColors.conditional.bg,
      textColor: themeColors.conditional.text,
      iconSvg: (
        <AlertTriangle style={{ width: `${config.statusIconSize}px`, height: `${config.statusIconSize}px` }} />
      ),
      label: "CONDITIONAL",
    },
    pass: {
      bgColor: themeColors.pass.bg,
      textColor: themeColors.pass.text,
      iconSvg: (
        <Check style={{ width: `${config.statusIconSize}px`, height: `${config.statusIconSize}px` }} />
      ),
      label: "PASS",
    },
    closed: {
      bgColor: themeColors.closed.bg,
      textColor: themeColors.closed.text,
      iconSvg: (
        <XCircle style={{ width: `${config.statusIconSize}px`, height: `${config.statusIconSize}px` }} />
      ),
      label: "CLOSED",
    },
  };
  
  const currentStatusConfig = statusConfig[status];
  const scoreColor = getScoreColor(restaurant.cleanplate_score);
  const ViolationIcon = violationConfig?.icon;
  
  // Get card border color based on status (for hover state)
  const getCardBorderColor = (): string => {
    if (status === "closed") return "hover:border-gray-400";
    if (status === "fail") return "hover:border-red-400";
    if (status === "conditional") return "hover:border-amber-400";
    return "hover:border-emerald-400"; // pass
  };
  
  const cardBorderColor = getCardBorderColor();
  const isBadgeStyle = themeColors.style === "badge";
  
  return (
    <div 
      onClick={handlePress}
      className={`bg-white border-2 border-transparent ${cardBorderColor} rounded-2xl shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden group outline-none`}
      style={{ width: `${config.cardWidth}px` }}
    >
      {/* Banner Style - Full width colored banner (only for banner style) */}
      {!isBadgeStyle && (
        <div 
          className={`${currentStatusConfig.bgColor} px-5 py-2.5`}
          style={{ minHeight: `${config.statusBannerHeight}px` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-help" title="Inspection Result">
              <div className={currentStatusConfig.textColor}>
                {currentStatusConfig.iconSvg}
              </div>
              <span 
                className={`font-bold tracking-wide uppercase ${currentStatusConfig.textColor}`}
                style={{ fontSize: `${config.statusTextSize}px` }}
              >
                {currentStatusConfig.label}
              </span>
            </div>
            <span 
              className={`font-bold ${currentStatusConfig.textColor} opacity-90`}
              style={{ fontSize: `${config.dateTextSize}px` }}
            >
              {formattedDate}
            </span>
          </div>
        </div>
      )}
      
      {/* Image Section */}
      <div 
        className={`relative bg-gray-200 overflow-hidden ${isBadgeStyle ? 'rounded-t-2xl' : ''}`}
        style={{ height: `${config.imageSectionHeight}px` }}
      >
        {imageLoading ? (
          /* Loading skeleton */
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
        ) : imageUrl ? (
          /* Yelp image - scales up slightly on hover */
          <img 
            src={imageUrl} 
            alt={restaurant.dba_name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
          />
        ) : (
          /* Fallback placeholder */
          <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center transition-transform duration-300 ease-out group-hover:scale-110">
            <Utensils className="w-16 h-16 text-gray-500 opacity-50" />
          </div>
        )}
        
        {/* Badge Style - Overlay badges on image */}
        {isBadgeStyle && (
          <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between">
            {/* Status Badge */}
            <div 
              className={`${currentStatusConfig.bgColor} px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg`}
              title="Inspection Result"
            >
              <div className={currentStatusConfig.textColor}>
                {currentStatusConfig.iconSvg}
              </div>
              <span 
                className={`font-bold tracking-wide uppercase ${currentStatusConfig.textColor}`}
                style={{ fontSize: `${config.statusTextSize - 2}px` }}
              >
                {currentStatusConfig.label}
              </span>
            </div>
            
            {/* Date Badge */}
            <div className={`${themeColors.dateBadge.bg} px-3 py-1.5 rounded-full shadow-lg`}>
              <span 
                className={`font-semibold ${themeColors.dateBadge.text}`}
                style={{ fontSize: `${config.dateTextSize}px` }}
              >
                {formattedDate}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <div 
        className="flex flex-col gap-4"
        style={{ padding: `${config.contentPadding}px` }}
      >
        {/* Top Row: Name/Address and Score */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Restaurant Name - Bold */}
            <h3 
              className="font-bold text-[#0d1b12] mb-1 line-clamp-1 group-hover:text-emerald-700 transition-colors"
              style={{ fontSize: `${config.restaurantNameSize}px` }}
            >
              {formattedRestaurantName}
            </h3>
            
            {/* Address */}
            <div className="flex items-center gap-1.5">
              <MapPin 
                className="text-gray-500 flex-shrink-0" 
                style={{ width: `${config.locationIconSize}px`, height: `${config.locationIconSize}px` }}
              />
              <p 
                className="text-[#6b7280] line-clamp-1"
                style={{ fontSize: `${config.addressTextSize}px` }}
              >
                {restaurant.address}
              </p>
            </div>
          </div>
          
          {/* Circular Score Display */}
          <div className="flex-shrink-0 flex flex-col items-center group/score relative">
            <div 
              className="relative cursor-help" 
              style={{ width: `${config.scoreIconSize}px`, height: `${config.scoreIconSize}px` }}
              title="CleanPlate Score"
            >
              <svg
                width={config.scoreIconSize}
                height={config.scoreIconSize}
                viewBox="0 0 48 48"
                className="transform -rotate-90"
              >
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - restaurant.cleanplate_score / 100)}`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div 
                className="absolute inset-0 flex items-center justify-center font-extrabold"
                style={{ color: scoreColor, fontSize: `${config.scoreTextSize}px` }}
              >
                {restaurant.cleanplate_score}
              </div>
            </div>
          </div>
        </div>
        
        {/* Violation Badge - Show for FAILED or CONDITIONAL, "No Violations" for PASS, "Permanently Closed" for CLOSED */}
        {status === "closed" && (
          <div 
            className="bg-gray-100 rounded-lg px-3.5 py-1.5 inline-flex items-center gap-1.5 self-start"
            style={{ 
              borderWidth: `${config.badgeBorderThickness}px`,
              borderColor: "#d1d5db", // gray-300
              borderStyle: 'solid'
            }}
          >
            <XCircle 
              className="text-gray-600 flex-shrink-0"
              style={{ width: `${config.violationIconSize}px`, height: `${config.violationIconSize}px` }}
            />
            <span 
              className="font-bold text-gray-600"
              style={{ fontSize: `${config.violationTextSize}px` }}
            >
              Permanently Closed
            </span>
          </div>
        )}
        {status !== "pass" && status !== "closed" && violationConfig && ViolationIcon && (
          <div 
            className={`${violationConfig.bgColor} rounded-lg px-3.5 py-1.5 inline-flex items-center gap-1.5 self-start`}
            style={{ 
              borderWidth: `${config.badgeBorderThickness}px`,
              borderColor: status === "fail" ? "#fecaca" : "#fef3c7", // red-200 for fail, amber-100 for conditional (even lighter)
              borderStyle: 'solid'
            }}
          >
            <ViolationIcon 
              className={violationConfig.textColor}
              style={{ width: `${config.violationIconSize}px`, height: `${config.violationIconSize}px` }}
            />
            <span 
              className={`font-bold ${violationConfig.textColor}`}
              style={{ fontSize: `${config.violationTextSize}px` }}
            >
              {violationConfig.label}
            </span>
            {additionalThemesCount > 0 && (
              <>
                <span 
                  className={`font-bold ${violationConfig.textColor} opacity-60`}
                  style={{ fontSize: `${config.violationTextSize}px` }}
                >
                  •
                </span>
                <span 
                  className={`font-bold ${violationConfig.textColor} opacity-90`}
                  style={{ fontSize: `${config.violationTextSize}px` }}
                >
                  +{additionalThemesCount} more
                </span>
              </>
            )}
          </div>
        )}
        {status === "pass" && (
          <div 
            className="bg-emerald-50 rounded-lg px-3.5 py-1.5 inline-flex items-center gap-1.5 self-start"
            style={{ 
              borderWidth: `${config.badgeBorderThickness}px`,
              borderColor: "#d1fae5", // emerald-200 - lighter green
              borderStyle: 'solid'
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="15" 
              height="14" 
              viewBox="0 0 15 14" 
              fill="none"
              className="flex-shrink-0"
              style={{ width: `${config.violationIconSize}px`, height: `${config.violationIconSize}px` }}
            >
              <path d="M5.06667 14L3.8 11.8667L1.4 11.3333L1.63333 8.86667L0 7L1.63333 5.13333L1.4 2.66667L3.8 2.13333L5.06667 -9.53674e-07L7.33333 0.966666L9.6 -9.53674e-07L10.8667 2.13333L13.2667 2.66667L13.0333 5.13333L14.6667 7L13.0333 8.86667L13.2667 11.3333L10.8667 11.8667L9.6 14L7.33333 13.0333L5.06667 14ZM5.63333 12.3L7.33333 11.5667L9.06667 12.3L10 10.7L11.8333 10.2667L11.6667 8.4L12.9 7L11.6667 5.56667L11.8333 3.7L10 3.3L9.03333 1.7L7.33333 2.43333L5.6 1.7L4.66667 3.3L2.83333 3.7L3 5.56667L1.76667 7L3 8.4L2.83333 10.3L4.66667 10.7L5.63333 12.3ZM6.63333 9.36667L10.4 5.6L9.46667 4.63333L6.63333 7.46667L5.2 6.06667L4.26667 7L6.63333 9.36667Z" fill="#15803D"/>
            </svg>
            <span 
              className="font-bold text-emerald-700"
              style={{ fontSize: `${config.violationTextSize}px` }}
            >
              No Violations
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
