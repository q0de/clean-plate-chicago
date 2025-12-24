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
} from "recharts";

interface InspectionData {
  id: string;
  inspection_date: string;
  results: string;
  violation_count?: number;
  critical_count?: number;
}

export interface ViolationsTrendChartProps {
  inspections: InspectionData[];
  variant?: "default" | "resultHistory";
}

function getResultColor(result: string): string {
  const lower = result.toLowerCase();
  if (lower.includes("fail")) return "#ef4444";
  if (lower.includes("condition")) return "#f59e0b";
  return "#10b981";
}

export function ViolationsTrendChart({
  inspections,
  variant = "default",
}: ViolationsTrendChartProps) {
  const chartData = useMemo(() => {
    return [...inspections]
      .sort(
        (a, b) =>
          new Date(a.inspection_date).getTime() -
          new Date(b.inspection_date).getTime()
      )
      .map((inspection) => {
        const date = new Date(inspection.inspection_date);
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
          violations: inspection.violation_count ?? 0,
          critical: inspection.critical_count ?? 0,
          result: inspection.results,
          color: getResultColor(inspection.results),
        };
      });
  }, [inspections]);

  if (chartData.length === 0) return null;

  const maxViolations = Math.max(...chartData.map((d) => d.violations), 10);
  const isResultHistory = variant === "resultHistory";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxViolations]}
            tick={{ fontSize: 11, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;

              if (isResultHistory) {
                return (
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">{d.fullDate}</p>
                    <div
                      className="mt-1 text-xs font-semibold px-2 py-1 rounded-full text-center inline-block"
                      style={{ backgroundColor: d.color + "20", color: d.color }}
                    >
                      {d.result}
                    </div>
                    {d.critical > 0 && (
                      <p className="mt-2 text-xs text-red-600 font-medium">
                        {d.critical} critical
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 mb-1">{d.fullDate}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-2xl text-orange-500">
                      {d.violations}
                    </span>
                    <div className="text-xs">
                      <p className="text-gray-600">violations</p>
                      {d.critical > 0 && (
                        <p className="text-red-600 font-medium">
                          {d.critical} critical
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className="mt-2 text-xs font-semibold px-2 py-1 rounded-full text-center"
                    style={{ backgroundColor: d.color + "20", color: d.color }}
                  >
                    {d.result}
                  </div>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="violations"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#violationGradient)"
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <circle
                  key={payload.date}
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={payload.color}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-600">Pass</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-600">Conditional</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Fail</span>
        </div>
      </div>
    </div>
  );
}

