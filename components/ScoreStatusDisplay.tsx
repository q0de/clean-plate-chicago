"use client";

import { Check, AlertTriangle, X } from "lucide-react";
import { useDisplayMode, DisplayMode, DISPLAY_MODE_LABELS } from "@/lib/display-mode-context";

type Status = "pass" | "conditional" | "fail";

interface ScoreStatusDisplayProps {
  score: number;
  latestResult: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

// Helper to derive status from score and latest result
function deriveStatus(score: number, latestResult: string): Status {
  const result = latestResult.toLowerCase();
  if (result.includes("fail")) return "fail";
  if (result.includes("condition")) return "conditional";
  if (score < 60) return "conditional";
  return "pass";
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
  high: "#10b981", // emerald-500, >= 80
  medium: "#f59e0b", // amber-500, 60-79
  low: "#ef4444", // red-500, < 60
};

function getScoreColor(score: number): string {
  if (score >= 80) return scoreColors.high;
  if (score >= 60) return scoreColors.medium;
  return scoreColors.low;
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

// Reusable Score Ring component
function ScoreRing({ 
  score, 
  color, 
  size 
}: { 
  score: number; 
  color: string; 
  size: "sm" | "md" | "lg";
}) {
  const config = sizeConfig[size];
  const radius = (config.ring - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

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
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div 
        className="absolute inset-0 flex items-center justify-center font-bold"
        style={{ fontSize: config.fontSize, color }}
      >
        {score}
      </div>
    </div>
  );
}

// Status Badge component
function StatusBadge({ status, size }: { status: Status; size: "sm" | "md" | "lg" }) {
  const config = statusConfig[status];
  const colors = statusColors[status];
  const Icon = config.icon;
  const sizeConf = sizeConfig[size];

  return (
    <span className={`inline-flex items-center gap-1 font-bold tracking-wide rounded-full ${colors.bg} text-white ${sizeConf.badgeSize}`}>
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
  
  if (size === "sm") {
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


// Main component that renders the appropriate variant
export function ScoreStatusDisplay({ 
  score, 
  latestResult,
  size = "md",
  showLabel = false 
}: ScoreStatusDisplayProps) {
  const { mode } = useDisplayMode();
  const status = deriveStatus(score, latestResult);
  
  const variants: Record<DisplayMode, JSX.Element> = {
    A: <VariantA score={score} status={status} size={size} />,
    B: <VariantB score={score} status={status} size={size} />,
    C: <VariantC score={score} status={status} size={size} />,
    D: <VariantD score={score} status={status} size={size} />,
    E: <VariantE score={score} status={status} size={size} />,
  };

  return variants[mode];
}

// Display Mode Selector - exported for flexible placement
export function DisplayModeSelector() {
  const { mode, setMode } = useDisplayMode();
  const modes: DisplayMode[] = ["A", "B", "C", "D", "E"];

  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border border-gray-200">
      <span className="text-xs font-medium text-gray-500">Display:</span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as DisplayMode)}
        className="text-xs font-medium bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 pr-6"
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

// Compact version for map cards - always uses small size
export function ScoreStatusDisplayCompact({ 
  score, 
  latestResult 
}: { 
  score: number; 
  latestResult: string;
}) {
  const { mode } = useDisplayMode();
  const status = deriveStatus(score, latestResult);
  
  const variants: Record<DisplayMode, JSX.Element> = {
    A: <VariantA score={score} status={status} size="sm" />,
    B: <VariantB score={score} status={status} size="sm" />,
    C: <VariantC score={score} status={status} size="sm" />,
    D: <VariantD score={score} status={status} size="sm" />,
    E: <VariantE score={score} status={status} size="sm" />,
  };

  return variants[mode];
}
