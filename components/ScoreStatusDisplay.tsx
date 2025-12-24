"use client";

import React from "react";
import { Check, AlertTriangle, X, Clock } from "lucide-react";

type Status = "pass" | "conditional" | "fail" | "unknown";

interface ScoreStatusDisplayProps {
  score: number;
  latestResult: string;
  size?: "sm" | "md" | "lg";
  latestInspectionDate?: string;
}

// Helper to derive status from latest result
function deriveStatus(latestResult: string): Status {
  const result = latestResult.toLowerCase();
  if (result.includes("fail")) return "fail";
  if (result.includes("condition")) return "conditional";
  if (result.includes("pass")) return "pass";
  return "unknown";
}

// Helper to format result text for display
function formatResultText(latestResult: string): string {
  const result = latestResult.toLowerCase();
  if (result.includes("fail")) return "Fail";
  if (result.includes("condition")) return "Conditional";
  if (result.includes("pass") && result.includes("condition")) return "Conditional";
  if (result.includes("pass")) return "Pass";
  if (result.includes("no entry")) return "No Entry";
  if (result.includes("out of business")) return "Closed";
  if (result.includes("not ready")) return "Not Ready";
  return "Unknown";
}

// Color configurations - softer, pastel-toned colors
const statusColors = {
  pass: {
    bg: "bg-emerald-400",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  conditional: {
    bg: "bg-amber-300",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  fail: {
    bg: "bg-red-400",
    bgLight: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  unknown: {
    bg: "bg-gray-300",
    bgLight: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-600",
  },
};

// Score color based on value - 4 tiers including exceptional (90+)
function getScoreColor(score: number): string {
  if (score >= 90) return "#14b8a6"; // teal-500 (exceptional green-blue)
  if (score >= 80) return "#10b981"; // emerald-500 (green)
  if (score >= 60) return "#f59e0b"; // amber-500 (yellow)
  return "#ef4444"; // red-500
}

const statusConfig = {
  pass: { icon: Check, label: "Pass" },
  conditional: { icon: AlertTriangle, label: "Conditional" },
  fail: { icon: X, label: "Fail" },
  unknown: { icon: Clock, label: "Unknown" },
};

const sizeConfig = {
  sm: { ring: 48, fontSize: 16, strokeWidth: 4, iconSize: "w-3 h-3", badgeSize: "text-xs px-2 py-0.5" },
  md: { ring: 80, fontSize: 28, strokeWidth: 6, iconSize: "w-4 h-4", badgeSize: "text-sm px-3 py-1" },
  lg: { ring: 160, fontSize: 48, strokeWidth: 10, iconSize: "w-5 h-5", badgeSize: "text-base px-4 py-2" },
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
    // Instant display - no animation delay
    setAnimatedScore(score);
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
          className="transition-all duration-400 ease-out"
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

// Status Badge component - shows the official inspection result
function StatusBadge({ 
  status, 
  resultText, 
  size 
}: { 
  status: Status; 
  resultText: string; 
  size: "sm" | "md" | "lg"; 
}) {
  const config = statusConfig[status];
  const colors = statusColors[status];
  const Icon = config.icon;
  const sizeConf = sizeConfig[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${colors.bg} text-white ${sizeConf.badgeSize}`}>
      <Icon className={sizeConf.iconSize} />
      {resultText}
    </span>
  );
}

// Format date for display
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric" 
  });
}

/**
 * ScoreStatusDisplay - Unified display component
 * Shows: CleanPlate Score (ring) + Latest Inspection Result (badge) + Date
 */
export function ScoreStatusDisplay({ 
  score, 
  latestResult,
  size = "md",
  latestInspectionDate
}: ScoreStatusDisplayProps) {
  const status = deriveStatus(latestResult);
  const resultText = formatResultText(latestResult);
  const scoreColor = getScoreColor(score);
  
  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <div className="cursor-help" title="CleanPlate Score">
          <ScoreRing score={score} color={scoreColor} size="sm" />
        </div>
        <div className="cursor-help" title="Inspection Result">
          <StatusBadge status={status} resultText={resultText} size="sm" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <ScoreRing score={score} color={scoreColor} size={size} />
      <div className="flex flex-col items-center gap-2">
        <StatusBadge status={status} resultText={resultText} size={size} />
        {latestInspectionDate && (
          <span className="text-xs text-gray-500">
            {formatDate(latestInspectionDate)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ScoreStatusDisplayCompact - Compact version for cards and lists
 */
export function ScoreStatusDisplayCompact({ 
  score, 
  latestResult,
  latestInspectionDate
}: { 
  score: number; 
  latestResult: string;
  latestInspectionDate?: string;
}) {
  return (
    <ScoreStatusDisplay 
      score={score} 
      latestResult={latestResult} 
      size="sm"
      latestInspectionDate={latestInspectionDate}
    />
  );
}

/**
 * Standalone Status Badge - for use outside ScoreStatusDisplay
 */
export function InspectionStatusBadge({ 
  latestResult, 
  size = "sm" 
}: { 
  latestResult: string; 
  size?: "sm" | "md" | "lg";
}) {
  const status = deriveStatus(latestResult);
  const resultText = formatResultText(latestResult);
  return <StatusBadge status={status} resultText={resultText} size={size} />;
}

/**
 * Get score label based on score value
 */
export function getScoreLabel(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

// Export helper functions for use elsewhere
export { deriveStatus, formatResultText, getScoreColor, statusColors };
