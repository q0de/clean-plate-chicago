"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface InspectionData {
  id: string;
  inspection_date: string;
  results: string;
  score?: number;
  violation_count?: number;
  critical_count?: number;
  violations?: { is_critical?: boolean }[];
}

interface ScoreTrendChartProps {
  inspections: InspectionData[];
}

// Calculate a simple score based on result
function calculateScore(result: string): number {
  const lower = result.toLowerCase();
  if (lower.includes("fail")) return 35;
  if (lower.includes("pass w/ conditions") || lower.includes("conditional")) return 65;
  if (lower.includes("pass")) return 90;
  return 50;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981"; // emerald-500
  if (score >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      fullDate: string;
      score: number;
      result: string;
      violations?: number;
      critical?: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getScoreColor(data.score);
    
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[160px]">
        <p className="text-xs text-gray-500 mb-1">{data.fullDate}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="font-bold text-2xl" style={{ color }}>
            {data.score}
          </span>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            data.result.toLowerCase().includes("fail") 
              ? "bg-red-100 text-red-700"
              : data.result.toLowerCase().includes("condition")
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
          }`}>
            {data.result.toLowerCase().includes("fail") 
              ? "FAILED" 
              : data.result.toLowerCase().includes("condition")
                ? "CONDITIONAL"
                : "PASSED"}
          </span>
        </div>
        {typeof data.violations === "number" && (
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-semibold">{data.violations}</span> violations
            {typeof data.critical === "number" && data.critical > 0 && (
              <span className="text-red-600 font-semibold"> • {data.critical} critical</span>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
}

export function ScoreTrendChart({ inspections }: ScoreTrendChartProps) {
  const chartData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...inspections].sort(
      (a, b) => new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime()
    );

    return sorted.map((inspection) => {
      const date = new Date(inspection.inspection_date);
      const violations =
        inspection.violation_count ??
        inspection.violations?.length ??
        undefined;
      const critical =
        inspection.critical_count ??
        inspection.violations?.filter((v) => v.is_critical)?.length ??
        undefined;
      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        fullDate: date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        score: inspection.score ?? calculateScore(inspection.results),
        result: inspection.results,
        violations,
        critical,
        // Add a unique timestamp for proper ordering
        timestamp: date.getTime(),
      };
    });
  }, [inspections]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <span className="text-4xl mb-2 block">📊</span>
        <p className="text-gray-500">No inspection data available for chart</p>
      </div>
    );
  }

  // Calculate gradient stops based on score thresholds
  const gradientId = "scoreGradient";

  return (
    <div>
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            
            {/* Reference lines for score thresholds */}
            <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />
            <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const color = getScoreColor(payload.score);
                return (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{
                r: 7,
                stroke: "white",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Pass (80+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-600">Conditional (60-79)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Fail (&lt;60)</span>
        </div>
      </div>
    </div>
  );
}

