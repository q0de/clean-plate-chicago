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

// Sample inspection data
const sampleInspections = [
  { id: "1", inspection_date: "2023-11-03", results: "Fail", violation_count: 8, critical_count: 2 },
  { id: "2", inspection_date: "2024-01-15", results: "Pass w/ Conditions", violation_count: 5, critical_count: 1 },
  { id: "3", inspection_date: "2024-05-22", results: "Pass", violation_count: 2, critical_count: 0 },
  { id: "4", inspection_date: "2024-09-10", results: "Pass", violation_count: 1, critical_count: 0 },
  { id: "5", inspection_date: "2024-11-18", results: "Pass w/ Conditions", violation_count: 4, critical_count: 1 },
];

// ============================================
// OPTION A: Current "Score Trend" (fake scores)
// ============================================
function CurrentScoreTrendChart({ inspections }: { inspections: typeof sampleInspections }) {
  const chartData = useMemo(() => {
    return [...inspections]
      .sort((a, b) => new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime())
      .map((inspection) => {
        const date = new Date(inspection.inspection_date);
        const lower = inspection.results.toLowerCase();
        // FAKE SCORES - this is the problem
        let score = 50;
        if (lower.includes("fail")) score = 35;
        else if (lower.includes("condition")) score = 65;
        else if (lower.includes("pass")) score = 90;

        return {
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
          fullDate: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          score,
          result: inspection.results,
        };
      });
  }, [inspections]);

  function getScoreColor(score: number): string {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">Score Trend</h3>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Current (misleading)</span>
        </div>
        <p className="text-sm text-gray-500">Inspection scores over time</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} ticks={[0, 25, 50, 75, 100]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const color = getScoreColor(d.score);
              return (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[160px]">
                  <p className="text-xs text-gray-500 mb-1">{d.fullDate}</p>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-2xl" style={{ color }}>{d.score}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      d.result.toLowerCase().includes("fail") ? "bg-red-100 text-red-700"
                        : d.result.toLowerCase().includes("condition") ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {d.result.toLowerCase().includes("fail") ? "FAILED" 
                        : d.result.toLowerCase().includes("condition") ? "CONDITIONAL" : "PASSED"}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#scoreGradient)"
            dot={(props) => {
              const { cx, cy, payload } = props;
              const color = getScoreColor(payload.score);
              return <circle key={payload.date} cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

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

      <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-800">
        <strong>⚠️ Problem:</strong> These aren&apos;t real CleanPlate scores. They&apos;re just Pass→90, Conditional→65, Fail→35. 
        The &quot;65&quot; for conditional looks like a failing score per the legend!
      </div>
    </div>
  );
}

// ============================================
// OPTION B: Violations Trend (real data)
// ============================================
function ViolationsTrendChart({ inspections }: { inspections: typeof sampleInspections }) {
  const chartData = useMemo(() => {
    return [...inspections]
      .sort((a, b) => new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime())
      .map((inspection) => {
        const date = new Date(inspection.inspection_date);
        const lower = inspection.results.toLowerCase();
        let color = "#10b981";
        if (lower.includes("fail")) color = "#ef4444";
        else if (lower.includes("condition")) color = "#f59e0b";

        return {
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
          fullDate: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          violations: inspection.violation_count ?? 0,
          critical: inspection.critical_count ?? 0,
          result: inspection.results,
          color,
        };
      });
  }, [inspections]);

  const maxViolations = Math.max(...chartData.map(d => d.violations), 10);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">Violations Over Time</h3>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Proposed (honest)</span>
        </div>
        <p className="text-sm text-gray-500">Fewer is better — dots show inspection outcome</p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="violationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} />
          <YAxis domain={[0, maxViolations]} tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[180px]">
                  <p className="text-xs text-gray-500 mb-1">{d.fullDate}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-2xl text-orange-500">{d.violations}</span>
                    <div className="text-xs">
                      <p className="text-gray-600">violations</p>
                      {d.critical > 0 && <p className="text-red-600 font-medium">{d.critical} critical</p>}
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
              return <circle key={payload.date} cx={cx} cy={cy} r={6} fill={payload.color} stroke="white" strokeWidth={2} />;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

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

      <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
        <strong>✓ Better:</strong> Shows real data (violation counts). Downward trend = improvement. 
        Colored dots still communicate Pass/Fail/Conditional at a glance.
      </div>
    </div>
  );
}

// ============================================
// Demo Page
// ============================================
export default function ChartDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Chart Comparison</h1>
        <p className="text-gray-600 mb-8">
          Comparing the current misleading &quot;Score Trend&quot; vs the proposed &quot;Violations Over Time&quot;
        </p>

        <div className="grid gap-6">
          <CurrentScoreTrendChart inspections={sampleInspections} />
          <ViolationsTrendChart inspections={sampleInspections} />
        </div>

        <div className="mt-8 p-4 bg-white rounded-xl border border-gray-200">
          <h2 className="font-bold text-gray-900 mb-2">Sample Data Used:</h2>
          <div className="text-sm text-gray-600 space-y-1">
            {sampleInspections.map((i) => (
              <div key={i.id} className="flex gap-4">
                <span className="font-mono">{i.inspection_date}</span>
                <span className={
                  i.results.includes("Fail") ? "text-red-600" 
                  : i.results.includes("Condition") ? "text-amber-600" 
                  : "text-emerald-600"
                }>{i.results}</span>
                <span>{i.violation_count} violations ({i.critical_count} critical)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

