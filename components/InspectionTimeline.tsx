"use client";

import { useState } from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Check, X, AlertTriangle, ChevronDown, ChevronRight, Calendar, FileText, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Map violation codes to categories with emojis
function getViolationCategory(code: string): { emoji: string; label: string; bgColor: string; textColor: string } {
  const codeNum = parseInt(code);
  
  if (codeNum >= 1 && codeNum <= 5) {
    return { emoji: "👥", label: "Staff/Certification", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  if (codeNum >= 6 && codeNum <= 20) {
    return { emoji: "🌡️", label: "Food Safety", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  if (codeNum >= 21 && codeNum <= 31) {
    return { emoji: "🧼", label: "Contamination", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  if (codeNum >= 32 && codeNum <= 37) {
    return { emoji: "🏷️", label: "Storage/Labeling", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  if (codeNum === 38) {
    return { emoji: "🐀", label: "Pests/Rodents", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  if (codeNum >= 39 && codeNum <= 42) {
    return { emoji: "⚠️", label: "Chemical Safety", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  if (codeNum >= 43 && codeNum <= 58) {
    return { emoji: "🏢", label: "Facilities", bgColor: "bg-blue-100", textColor: "text-blue-700" };
  }
  if (codeNum >= 59) {
    return { emoji: "📋", label: "Prior Violations", bgColor: "bg-gray-100", textColor: "text-gray-700" };
  }
  
  return { emoji: "⚠️", label: "Other", bgColor: "bg-gray-100", textColor: "text-gray-700" };
}

export interface Violation {
  id: string;
  violation_code: string;
  violation_description: string;
  violation_comment?: string;
  is_critical: boolean;
  plain_english?: string;
}

export interface TimelineInspection {
  id: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  violations: Violation[];
}

interface InspectionTimelineProps {
  inspections: TimelineInspection[];
  initialCount?: number;
  loadMoreCount?: number;
  onLoadMore?: () => Promise<TimelineInspection[]>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function getStatus(result: string): "pass" | "conditional" | "fail" {
  if (result.toLowerCase().includes("fail")) return "fail";
  if (result.toLowerCase().includes("condition")) return "conditional";
  return "pass";
}

const statusConfig = {
  pass: {
    icon: Check,
    bgColor: "bg-emerald-500",
    ringColor: "ring-emerald-200",
    label: "Passed",
    chipBg: "bg-emerald-100",
    chipText: "text-emerald-700",
  },
  conditional: {
    icon: AlertTriangle,
    bgColor: "bg-amber-500",
    ringColor: "ring-amber-200",
    label: "Conditional",
    chipBg: "bg-amber-100",
    chipText: "text-amber-700",
  },
  fail: {
    icon: X,
    bgColor: "bg-red-500",
    ringColor: "ring-red-200",
    label: "Failed",
    chipBg: "bg-red-100",
    chipText: "text-red-700",
  },
};

export function InspectionTimeline({ 
  inspections, 
  initialCount = 3,
  loadMoreCount = 5,
  onLoadMore,
  hasMore: externalHasMore,
  isLoadingMore = false
}: InspectionTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  if (inspections.length === 0) {
    return (
      <Card className="bg-white border border-gray-200">
        <CardBody className="py-12 text-center">
          <span className="text-4xl mb-3 block">📋</span>
          <p className="text-gray-500 font-medium">No inspection history available</p>
        </CardBody>
      </Card>
    );
  }

  // Sort by date descending (most recent first)
  const sortedInspections = [...inspections].sort(
    (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
  );

  // Calculate what to show
  const hasMoreToShow = sortedInspections.length > visibleCount || externalHasMore;
  const visibleInspections = sortedInspections.slice(0, visibleCount);
  const teaserInspection = sortedInspections[visibleCount]; // The faded 4th item

  const handleLoadMore = async () => {
    if (onLoadMore) {
      await onLoadMore();
    }
    setVisibleCount(prev => prev + loadMoreCount);
  };

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {visibleInspections.map((inspection, index) => {
          const status = getStatus(inspection.results);
          const config = statusConfig[status];
          const Icon = config.icon;
          const isExpanded = expandedId === inspection.id;
          const criticalCount = inspection.violations.filter(v => v.is_critical).length;

          return (
            <div key={inspection.id} className="relative pl-14">
              {/* Timeline marker */}
              <div
                className={`absolute left-2 top-4 w-7 h-7 rounded-full ${config.bgColor} ring-4 ${config.ringColor} flex items-center justify-center z-10`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>

              {/* Card */}
              <Card
                className={`bg-white border transition-all ${
                  isExpanded ? "border-gray-300 shadow-md" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <CardBody className="p-0">
                  {/* Header - clickable */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : inspection.id)}
                    className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Date and type */}
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-semibold text-gray-900">
                          {new Date(inspection.inspection_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 text-sm truncate">
                          {inspection.inspection_type}
                        </span>
                      </div>

                      {/* Status and violations */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${config.chipBg} ${config.chipText}`}>
                          {config.label}
                        </span>
                        
                        {inspection.violations.length > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {inspection.violations.length} violation{inspection.violations.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        
                        {criticalCount > 0 && (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full flex items-center gap-1">
                            🚨 {criticalCount} critical
                          </span>
                        )}

                        {index === 0 && (
                          <Chip size="sm" color="primary" variant="flat" className="ml-auto">
                            Latest
                          </Chip>
                        )}
                      </div>

                      {/* Time ago */}
                      <p className="text-xs text-gray-400 mt-2">
                        {formatDistanceToNow(new Date(inspection.inspection_date), { addSuffix: true })}
                      </p>
                    </div>

                    {/* Expand icon */}
                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {inspection.violations.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Violations Found</span>
                          </div>
                          
                          <div className="space-y-2">
                            {inspection.violations.map((violation) => {
                              const category = getViolationCategory(violation.violation_code);
                              
                              return (
                                <div
                                  key={violation.id}
                                  className={`p-3 rounded-lg border ${
                                    violation.is_critical
                                      ? "border-red-200 bg-red-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${category.bgColor} ${category.textColor} flex items-center gap-1`}>
                                      {category.emoji} {category.label}
                                    </span>
                                    <span className="text-xs font-medium text-gray-500 px-2 py-0.5 rounded-full border border-gray-300">
                                      #{violation.violation_code}
                                    </span>
                                    {violation.is_critical && (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                                        🚨 CRITICAL
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-700">
                                    {violation.plain_english || violation.violation_description}
                                  </p>
                                  {violation.violation_comment && (
                                    <p className="text-xs text-gray-500 mt-2 italic">
                                      "{violation.violation_comment}"
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="p-2 bg-emerald-100 rounded-full">
                            <Check className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-emerald-800">No violations recorded</p>
                            <p className="text-xs text-emerald-600">This inspection had no documented issues</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          );
        })}

        {/* Faded teaser for next inspection */}
        {teaserInspection && hasMoreToShow && (
          <div className="relative pl-14 opacity-40 pointer-events-none">
            {/* Timeline marker */}
            <div className="absolute left-2 top-4 w-7 h-7 rounded-full bg-gray-300 ring-4 ring-gray-100 flex items-center justify-center z-10">
              <Calendar className="w-4 h-4 text-gray-500" />
            </div>

            {/* Faded Card */}
            <Card className="bg-white border border-gray-200">
              <CardBody className="p-0">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-900">
                      {new Date(teaserInspection.inspection_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* Load More Button */}
      {hasMoreToShow && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-700 font-semibold rounded-full transition-all disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More History
                <span className="text-xs text-gray-400 ml-1">
                  ({sortedInspections.length - visibleCount} more)
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
