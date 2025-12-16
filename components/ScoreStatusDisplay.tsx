"use client";

import React from "react";
import { Check, AlertTriangle, X } from "lucide-react";
import { useDisplayMode, DisplayMode, DISPLAY_MODE_LABELS } from "@/lib/display-mode-context";
import { useStatusBadgeStyle } from "@/lib/status-badge-context";

type Status = "pass" | "conditional" | "fail";

interface ScoreStatusDisplayProps {
  score: number;
  latestResult: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  violationCount?: number;
  criticalCount?: number;
  forceMode?: DisplayMode;
  latestInspectionResult?: string; // Optional: actual result from latest inspection
}

// Helper to derive status from score and latest result
function deriveStatus(score: number, latestResult: string): Status {
  const result = latestResult.toLowerCase();
  if (result.includes("fail")) return "fail";
  if (result.includes("condition")) return "conditional";
  if (score < 60) return "conditional";
  return "pass";
}

// Helper to get CleanPlate score label based on score
function getCleanPlateLabel(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 50) return "POOR";
  return "LOW";
}

// Helper to get CleanPlate score color based on score
function getCleanPlateBadgeColor(score: number): string {
  if (score >= 90) return "bg-blue-500";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 70) return "bg-amber-500";
  if (score >= 60) return "bg-orange-500";
  return "bg-red-500";
}

// Calculate Latest Inspection Score from violations and result
function calculateLatestInspectionScore(
  violationCount: number, 
  criticalCount: number,
  latestResult?: string
): number {
  const nonCriticalCount = Math.max(0, violationCount - criticalCount);
  let score = 100 - (criticalCount * 15) - (nonCriticalCount * 5);
  
  // Adjust based on actual inspection result
  if (latestResult) {
    const result = latestResult.toLowerCase();
    if (result.includes("fail")) {
      // Failed inspections should cap at a lower maximum
      score = Math.min(score, 50);
    } else if (result.includes("condition")) {
      // Conditional passes should cap at 75
      score = Math.min(score, 75);
    }
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Color configurations
const statusColors = {
  pass: {
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-50",
    border: "border-emerald-500",
    text: "text-emerald-600",
    ring: "#10b981",
  },
  conditional: {
    bg: "bg-amber-500",
    bgLight: "bg-amber-50",
    border: "border-amber-500",
    text: "text-amber-600",
    ring: "#f59e0b",
  },
  fail: {
    bg: "bg-red-500",
    bgLight: "bg-red-50",
    border: "border-red-500",
    text: "text-red-600",
    ring: "#ef4444",
  },
};

const scoreColors = {
  excellent: "#3b82f6", // blue-500, >= 90
  great: "#10b981", // emerald-500, 80-89
  good: "#f59e0b", // amber-500, 70-79
  fair: "#f97316", // orange-500, 60-69
  poor: "#ef4444", // red-500, < 60
};

function getScoreColor(score: number): string {
  if (score >= 90) return scoreColors.excellent;
  if (score >= 80) return scoreColors.great;
  if (score >= 70) return scoreColors.good;
  if (score >= 60) return scoreColors.fair;
  return scoreColors.poor;
}

// Latest Inspection score color - no blue, green for 71+ (passing), yellow for 60-70
function getLatestInspectionScoreColor(score: number): string {
  if (score >= 71) return scoreColors.great; // Green for passing scores (71+)
  if (score >= 60) return scoreColors.good; // Yellow for borderline (60-70)
  return scoreColors.poor; // Red for failing (<60)
}

const sizeConfig = {
  sm: { ring: 48, fontSize: 16, strokeWidth: 4, iconSize: "w-3 h-3", badgeSize: "text-xs px-2 py-0.5" },
  md: { ring: 80, fontSize: 28, strokeWidth: 6, iconSize: "w-4 h-4", badgeSize: "text-sm px-3 py-1" },
  lg: { ring: 160, fontSize: 48, strokeWidth: 10, iconSize: "w-5 h-5", badgeSize: "text-base px-4 py-2" },
};

const statusConfig = {
  pass: { icon: Check, label: "PASSED" },
  conditional: { icon: AlertTriangle, label: "CONDITIONAL" },
  fail: { icon: X, label: "FAILED" },
};

// Reusable Score Ring component with count-up animation
function ScoreRing({ 
  score, 
  color, 
  size 
}: { 
  score: number; 
  color: string; 
  size: "sm" | "md" | "lg";
}) {
  const [animatedScore, setAnimatedScore] = React.useState(0);
  const config = sizeConfig[size];
  const radius = (config.ring - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  React.useEffect(() => {
    // Reset to 0 when score changes
    setAnimatedScore(0);
    
    // Animate count-up
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = score / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const newScore = Math.min(score, increment * currentStep);
      setAnimatedScore(Math.round(newScore));
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedScore(score);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [score]);

  return (
    <div className="relative" style={{ width: config.ring, height: config.ring }}>
      <svg
        width={config.ring}
        height={config.ring}
        viewBox={`0 0 ${config.ring} ${config.ring}`}
        className="transform -rotate-90"
      >
        <circle
          cx={config.ring / 2}
          cy={config.ring / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={config.strokeWidth}
        />
        <circle
          cx={config.ring / 2}
          cy={config.ring / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1500 ease-out"
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center font-bold transition-all duration-300"
        style={{ fontSize: config.fontSize, color }}
      >
        {animatedScore}
      </div>
    </div>
  );
}

// Status Badge component
function StatusBadge({ status, size, forceText = false }: { status: Status; size: "sm" | "md" | "lg"; forceText?: boolean }) {
  const config = statusConfig[status];
  const colors = statusColors[status];
  const Icon = config.icon;
  const sizeConf = sizeConfig[size];
  const { style } = useStatusBadgeStyle();

  // If forceText is true, always show text (for business detail page)
  const showText = forceText || style === "icon-text";

  if (!showText) {
    return (
      <span className={`inline-flex items-center justify-center font-bold tracking-wide rounded-full ${colors.bg} text-white ${sizeConf.badgeSize}`}>
        <Icon className={sizeConf.iconSize} />
      </span>
    );
  }

  // icon-text style: icon on left, text on right
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold tracking-wide rounded-full ${colors.bg} text-white ${sizeConf.badgeSize}`}>
      <Icon className={sizeConf.iconSize} />
      {config.label}
    </span>
  );
}

// ==================== VARIANT IMPLEMENTATIONS ====================

// Option A: Current (Separate) - Status badge and score ring shown separately
function VariantA({ score, status, size }: { score: number; status: Status; size: "sm" | "md" | "lg" }) {
  const scoreColor = getScoreColor(score);
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <ScoreRing score={score} color={scoreColor} size="sm" />
        <StatusBadge status={status} size="sm" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <StatusBadge status={status} size={size} />
      <ScoreRing score={score} color={scoreColor} size={size} />
      <span className="text-xs text-gray-500 font-medium">CleanPlate Score</span>
    </div>
  );
}

// Option B: Unified Card - Single card combining both metrics
function VariantB({ score, status, size }: { score: number; status: Status; size: "sm" | "md" | "lg" }) {
  const colors = statusColors[status];
  const config = statusConfig[status];
  const Icon = config.icon;

  if (size === "sm") {
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 ${colors.border} ${colors.bgLight}`}>
        <span className={`text-xl font-bold ${colors.text}`}>{score}</span>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${colors.bg} text-white text-[10px] font-bold`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center p-6 rounded-2xl border-2 ${colors.border} ${colors.bgLight}`}>
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${colors.bg} text-white font-bold mb-4`}>
        <Icon className="w-5 h-5" />
        {config.label}
      </div>
      <span className={`text-6xl font-bold ${colors.text}`}>{score}</span>
      <span className={`text-sm ${colors.text} mt-2`}>CleanPlate Score</span>
    </div>
  );
}

// Option C: Status-Colored Score - Ring color matches inspection result
function VariantC({ score, status, size }: { score: number; status: Status; size: "sm" | "md" | "lg" }) {
  const ringColor = statusColors[status].ring;
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <ScoreRing score={score} color={ringColor} size="sm" />
        <StatusBadge status={status} size="sm" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <StatusBadge status={status} size={size} />
      <ScoreRing score={score} color={ringColor} size={size} />
      <span className="text-xs text-gray-500 font-medium">CleanPlate Score</span>
    </div>
  );
}

// Option D: Dual Indicator - Score ring with embedded result icon
function VariantD({ score, status, size }: { score: number; status: Status; size: "sm" | "md" | "lg" }) {
  const scoreColor = getScoreColor(score);
  const colors = statusColors[status];
  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeConf = sizeConfig[size];
  const { style } = useStatusBadgeStyle();
  
  if (size === "sm") {
    if (style === "icon-text") {
      // Show pill badge with text overlapping the ring - positioned to hang over more
      return (
        <div className="relative">
          <ScoreRing score={score} color={scoreColor} size="sm" />
          <div className={`absolute -bottom-0.5 -right-0.5 ${colors.bg} text-white rounded-full px-1.5 py-0.5 shadow-md`}>
            <div className="flex items-center gap-1">
              <Icon className="w-3 h-3" />
              <span className="text-[10px] font-bold tracking-wide whitespace-nowrap">{config.label}</span>
            </div>
          </div>
        </div>
      );
    }
    // Icon only - original behavior with icon overlay
    return (
      <div className="relative">
        <ScoreRing score={score} color={scoreColor} size="sm" />
        <div className={`absolute -bottom-1 -right-1 p-1 rounded-full ${colors.bg} text-white`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
    );
  }
  
  const overlaySize = size === "lg" ? "p-2" : "p-1.5";
  const overlayIcon = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  
  if (style === "icon-text") {
    // Show pill badge with text overlapping the ring - positioned to hang over more
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <ScoreRing score={score} color={scoreColor} size={size} />
          <div className={`absolute -bottom-1 -right-1 ${colors.bg} text-white rounded-full px-2 py-1 shadow-lg`}>
            <div className="flex items-center gap-1.5">
              <Icon className={sizeConf.iconSize} />
              <span className="font-bold tracking-wide whitespace-nowrap">{config.label}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center mt-2">
          <span className="text-xs text-gray-500 font-medium">CleanPlate Score</span>
        </div>
      </div>
    );
  }
  
  // Icon only - original behavior
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <ScoreRing score={score} color={scoreColor} size={size} />
        <div className={`absolute -bottom-2 -right-2 ${overlaySize} rounded-full ${colors.bg} text-white shadow-lg`}>
          <Icon className={overlayIcon} />
        </div>
      </div>
      <div className="flex flex-col items-center mt-2">
        <span className="text-xs text-gray-500 font-medium">CleanPlate Score</span>
        <span className={`text-xs font-medium ${colors.text}`}>Latest: {config.label}</span>
      </div>
    </div>
  );
}

// Option E: Contextual Labels - Both metrics with explanatory labels
function VariantE({ score, status, size }: { score: number; status: Status; size: "sm" | "md" | "lg" }) {
  const scoreColor = getScoreColor(score);
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <ScoreRing score={score} color={scoreColor} size="sm" />
          <span className="text-[9px] text-gray-400 mt-0.5">Score</span>
        </div>
        <div className="flex flex-col items-center">
          <StatusBadge status={status} size="sm" />
          <span className="text-[9px] text-gray-400 mt-0.5">Result</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center">
        <StatusBadge status={status} size={size} />
        <span className="text-xs text-gray-500 mt-1">Latest Official Result</span>
      </div>
      <div className="flex flex-col items-center">
        <ScoreRing score={score} color={scoreColor} size={size} />
        <span className="text-xs text-gray-500 mt-2 font-medium">CleanPlate Score</span>
        <span className="text-[10px] text-gray-400">Includes history & trends</span>
      </div>
    </div>
  );
}

// ==================== DUAL SCORE VARIANT IMPLEMENTATIONS ====================

// Option F: Dual Rings Side-by-Side - Two score rings displayed horizontally
function VariantF({ 
  latestInspectionScore, 
  cleanplateScore, 
  status, 
  size 
}: { 
  latestInspectionScore: number | null; 
  cleanplateScore: number; 
  status: Status; 
  size: "sm" | "md" | "lg" 
}) {
  const latestColor = latestInspectionScore !== null ? getLatestInspectionScoreColor(latestInspectionScore) : "#9ca3af";
  const cleanplateColor = getScoreColor(cleanplateScore);
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size="sm" />
          <span className="text-[9px] text-gray-500 mt-0.5">Latest</span>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={cleanplateScore} color={cleanplateColor} size="sm" />
          <span className="text-[9px] text-gray-500 mt-0.5">CleanPlate</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center">
        <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size={size} />
        <span className="text-xs text-gray-500 mt-2 font-medium">Latest Inspection</span>
        {latestInspectionScore === null && (
          <span className="text-[10px] text-gray-400">N/A</span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <ScoreRing score={cleanplateScore} color={cleanplateColor} size={size} />
        <span className="text-xs text-gray-500 mt-2 font-medium">CleanPlate Score</span>
      </div>
    </div>
  );
}

// Option G: Stacked with Labels - Latest Inspection Score on top, CleanPlate Score below
function VariantG({ 
  latestInspectionScore, 
  cleanplateScore, 
  status, 
  size 
}: { 
  latestInspectionScore: number | null; 
  cleanplateScore: number; 
  status: Status; 
  size: "sm" | "md" | "lg" 
}) {
  const latestColor = latestInspectionScore !== null ? getLatestInspectionScoreColor(latestInspectionScore) : "#9ca3af";
  const cleanplateColor = getScoreColor(cleanplateScore);
  
  if (size === "sm") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-col items-center">
          <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size="sm" />
          <span className="text-[9px] text-gray-500 mt-0.5">Latest: {latestInspectionScore ?? "N/A"}</span>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={cleanplateScore} color={cleanplateColor} size="sm" />
          <span className="text-[9px] text-gray-500 mt-0.5">CleanPlate: {cleanplateScore}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center">
        <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size={size} />
        <span className="text-sm text-gray-700 mt-3 font-semibold">Latest Inspection Score</span>
        {latestInspectionScore !== null ? (
          <span className="text-xs text-gray-500 mt-1">Based on most recent inspection</span>
        ) : (
          <span className="text-xs text-gray-400 mt-1">Not available</span>
        )}
      </div>
      <div className="flex flex-col items-center">
        <ScoreRing score={cleanplateScore} color={cleanplateColor} size={size} />
        <span className="text-sm text-gray-700 mt-3 font-semibold">CleanPlate Score</span>
        <span className="text-xs text-gray-500 mt-1">Includes history & trends</span>
      </div>
    </div>
  );
}

// Option H: Split Card Layout - Card divided vertically
function VariantH({ 
  latestInspectionScore, 
  cleanplateScore, 
  status, 
  size,
  latestInspectionResult
}: { 
  latestInspectionScore: number | null; 
  cleanplateScore: number; 
  status: Status; 
  size: "sm" | "md" | "lg";
  latestInspectionResult?: string;
}) {
  const latestColor = latestInspectionScore !== null ? getLatestInspectionScoreColor(latestInspectionScore) : "#9ca3af";
  const cleanplateColor = getScoreColor(cleanplateScore);
  // Use latest inspection result to derive status for the left side, or fall back to overall status
  const latestStatus = latestInspectionResult 
    ? deriveStatus(latestInspectionScore ?? 0, latestInspectionResult)
    : status;
  const latestColors = statusColors[latestStatus];
  const overallColors = statusColors[status];
  const sizeConf = sizeConfig[size];
  
  if (size === "sm") {
    return (
      <div className={`flex items-center border-2 ${overallColors.border} ${overallColors.bgLight} rounded-lg overflow-hidden opacity-0 animate-[fadeInUp_0.5s_ease-out_0.1s_forwards]`}>
        <div className="flex-1 flex flex-col items-center py-2 px-2 border-r border-gray-300 opacity-0 animate-[fadeInLeft_0.5s_ease-out_0.2s_forwards]">
          <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size="sm" />
          <span className="text-[9px] text-gray-600 mt-0.5 font-medium">Latest</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-2 px-2 opacity-0 animate-[fadeInRight_0.5s_ease-out_0.3s_forwards]">
          <ScoreRing score={cleanplateScore} color={cleanplateColor} size="sm" />
          <span className="text-[9px] text-gray-600 mt-0.5 font-medium">CleanPlate</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex items-stretch border-2 ${overallColors.border} ${overallColors.bgLight} rounded-2xl overflow-hidden shadow-lg opacity-0 animate-[fadeInUp_0.7s_ease-out_0.1s_forwards]`}>
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 border-r-2 border-gray-300 opacity-0 animate-[fadeInLeft_0.7s_ease-out_0.2s_forwards]">
        <div className="opacity-0 animate-[zoomIn_0.7s_ease-out_0.3s_forwards]">
          <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size={size} />
        </div>
        <div className="mt-4 opacity-0 animate-[fadeIn_0.5s_ease-out_0.6s_forwards]">
          <StatusBadge status={latestStatus} size={size} forceText={true} />
        </div>
        <span className="text-sm text-gray-700 mt-3 font-semibold opacity-0 animate-[fadeIn_0.5s_ease-out_0.7s_forwards]">Latest Inspection</span>
        {latestInspectionScore !== null ? (
          <span className="text-xs text-gray-500 mt-1 opacity-0 animate-[fadeIn_0.5s_ease-out_0.8s_forwards]">Most recent only</span>
        ) : (
          <span className="text-xs text-gray-400 mt-1 opacity-0 animate-[fadeIn_0.5s_ease-out_0.8s_forwards]">N/A</span>
        )}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 opacity-0 animate-[fadeInRight_0.7s_ease-out_0.35s_forwards]">
        <div className="opacity-0 animate-[zoomIn_0.7s_ease-out_1.1s_forwards]">
          <ScoreRing score={cleanplateScore} color={cleanplateColor} size={size} />
        </div>
        <div className={`mt-4 ${getCleanPlateBadgeColor(cleanplateScore)} text-white rounded-full ${sizeConf.badgeSize} shadow-md opacity-0 animate-[fadeIn_0.5s_ease-out_1.4s_forwards]`}>
          <span className="font-bold tracking-wide">{getCleanPlateLabel(cleanplateScore)}</span>
        </div>
        <span className="text-sm text-gray-700 mt-3 font-semibold opacity-0 animate-[fadeIn_0.5s_ease-out_1.45s_forwards]">CleanPlate Score</span>
        <span className="text-xs text-gray-500 mt-1 opacity-0 animate-[fadeIn_0.5s_ease-out_1.5s_forwards]">With history</span>
      </div>
    </div>
  );
}

// Option I: Dual Rings with Status Center - Two rings with status badge positioned between/above
function VariantI({ 
  latestInspectionScore, 
  cleanplateScore, 
  status, 
  size 
}: { 
  latestInspectionScore: number | null; 
  cleanplateScore: number; 
  status: Status; 
  size: "sm" | "md" | "lg" 
}) {
  const latestColor = latestInspectionScore !== null ? getLatestInspectionScoreColor(latestInspectionScore) : "#9ca3af";
  const cleanplateColor = getScoreColor(cleanplateScore);
  
  if (size === "sm") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size="sm" />
          <StatusBadge status={status} size="sm" />
          <ScoreRing score={cleanplateScore} color={cleanplateColor} size="sm" />
        </div>
        <div className="flex items-center gap-4 text-[9px] text-gray-500">
          <span>Latest</span>
          <span>CleanPlate</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <ScoreRing score={latestInspectionScore ?? 0} color={latestColor} size={size} />
        <StatusBadge status={status} size={size} />
        <ScoreRing score={cleanplateScore} color={cleanplateColor} size={size} />
      </div>
      <div className="flex items-center gap-8 text-xs text-gray-500">
        <span className="font-medium">Latest Inspection</span>
        <span className="font-medium">CleanPlate Score</span>
      </div>
    </div>
  );
}

// Option J: Horizontal Comparison - Both scores in horizontal bar/row layout
function VariantJ({ 
  latestInspectionScore, 
  cleanplateScore, 
  status, 
  size 
}: { 
  latestInspectionScore: number | null; 
  cleanplateScore: number; 
  status: Status; 
  size: "sm" | "md" | "lg" 
}) {
  const latestColor = latestInspectionScore !== null ? getLatestInspectionScoreColor(latestInspectionScore) : "#9ca3af";
  const cleanplateColor = getScoreColor(cleanplateScore);
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`} style={{ backgroundColor: latestColor }}>
            {latestInspectionScore ?? "N/A"}
          </div>
          <span className="text-[10px] text-gray-600 font-medium">Latest</span>
        </div>
        <div className="w-px h-6 bg-gray-300" />
        <div className="flex items-center gap-1.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white`} style={{ backgroundColor: cleanplateColor }}>
            {cleanplateScore}
          </div>
          <span className="text-[10px] text-gray-600 font-medium">CleanPlate</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg`} style={{ backgroundColor: latestColor }}>
            {latestInspectionScore ?? "N/A"}
          </div>
          <span className="text-sm text-gray-700 font-semibold">Latest Inspection</span>
        </div>
        <div className="w-px h-16 bg-gray-300" />
        <div className="flex flex-col items-center gap-2">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg`} style={{ backgroundColor: cleanplateColor }}>
            {cleanplateScore}
          </div>
          <span className="text-sm text-gray-700 font-semibold">CleanPlate Score</span>
        </div>
      </div>
      <StatusBadge status={status} size={size} />
    </div>
  );
}


// Main component that renders the appropriate variant
export function ScoreStatusDisplay({ 
  score, 
  latestResult,
  size = "md",
  showLabel = false,
  violationCount,
  criticalCount,
  forceMode,
  latestInspectionResult
}: ScoreStatusDisplayProps) {
  const { mode: contextMode } = useDisplayMode();
  const mode = forceMode ?? contextMode;
  const status = deriveStatus(score, latestResult);
  
  // Calculate latest inspection score if violation data is provided
  const latestInspectionScore = violationCount !== undefined && criticalCount !== undefined
    ? calculateLatestInspectionScore(violationCount, criticalCount, latestResult)
    : null;
  
  const variants: Record<DisplayMode, JSX.Element> = {
    A: <VariantA score={score} status={status} size={size} />,
    B: <VariantB score={score} status={status} size={size} />,
    C: <VariantC score={score} status={status} size={size} />,
    D: <VariantD score={score} status={status} size={size} />,
    E: <VariantE score={score} status={status} size={size} />,
    F: <VariantF latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size={size} />,
    G: <VariantG latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size={size} />,
    H: <VariantH latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size={size} latestInspectionResult={latestInspectionResult} />,
    I: <VariantI latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size={size} />,
    J: <VariantJ latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size={size} />,
  };

  return variants[mode];
}

// Display Mode Selector - exported for flexible placement
export function DisplayModeSelector() {
  const { mode, setMode } = useDisplayMode();
  const modes: DisplayMode[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  return (
    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg shadow-md border-2 border-gray-300 hover:border-emerald-400 transition-colors">
      <span className="text-sm font-semibold text-gray-700">Display Mode:</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as DisplayMode)}
        className="text-sm font-medium bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer text-gray-900 min-w-[200px]"
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {m}. {DISPLAY_MODE_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
}

// Status Badge Style Selector - exported for flexible placement
export function StatusBadgeStyleSelector() {
  const { style, setStyle } = useStatusBadgeStyle();
  const styles: { value: "icon-only" | "icon-text"; label: string }[] = [
    { value: "icon-only", label: "Icon Only" },
    { value: "icon-text", label: "Icon + Text" },
  ];

  return (
    <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg shadow-md border-2 border-gray-300 hover:border-emerald-400 transition-colors">
      <span className="text-sm font-semibold text-gray-700">Status Badge:</span>
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value as "icon-only" | "icon-text")}
        className="text-sm font-medium bg-white border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer text-gray-900 min-w-[150px]"
      >
        {styles.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Compact version for map cards - always uses small size
export function ScoreStatusDisplayCompact({ 
  score, 
  latestResult,
  violationCount,
  criticalCount,
  forceMode
}: { 
  score: number; 
  latestResult: string;
  violationCount?: number;
  criticalCount?: number;
  forceMode?: DisplayMode;
}) {
  const { mode: contextMode } = useDisplayMode();
  const status = deriveStatus(score, latestResult);
  
  // Calculate latest inspection score if violation data is provided
  const latestInspectionScore = violationCount !== undefined && criticalCount !== undefined
    ? calculateLatestInspectionScore(violationCount, criticalCount, latestResult)
    : null;
  
  // Use forceMode if provided, otherwise use context mode
  const mode = forceMode ?? contextMode;
  
  const variants: Record<DisplayMode, JSX.Element> = {
    A: <VariantA score={score} status={status} size="sm" />,
    B: <VariantB score={score} status={status} size="sm" />,
    C: <VariantC score={score} status={status} size="sm" />,
    D: <VariantD score={score} status={status} size="sm" />,
    E: <VariantE score={score} status={status} size="sm" />,
    F: <VariantF latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size="sm" />,
    G: <VariantG latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size="sm" />,
    H: <VariantH latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size="sm" />,
    I: <VariantI latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size="sm" />,
    J: <VariantJ latestInspectionScore={latestInspectionScore} cleanplateScore={score} status={status} size="sm" />,
  };

  return variants[mode];
}
