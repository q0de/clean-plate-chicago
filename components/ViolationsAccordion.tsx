"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Bug, Droplets, Thermometer, Users, Utensils, Building2, FileWarning } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export interface Violation {
  id: string;
  violation_code: string;
  violation_description: string;
  violation_comment?: string;
  is_critical: boolean;
}

export interface Inspection {
  id: string;
  inspection_date: string;
  inspection_type: string;
  results: string;
  violations: Violation[];
}

interface ViolationsAccordionProps {
  inspections: Inspection[];
}

// Map violation codes to categories with icons and colors
function getViolationCategory(code: string): {
  icon: typeof AlertTriangle;
  emoji: string;
  label: string;
  bgColor: string;
  textColor: string;
} {
  const codeNum = parseInt(code);
  
  // Certification & Management (1-5)
  if (codeNum >= 1 && codeNum <= 5) {
    return { icon: Users, emoji: "👥", label: "Staff/Certification", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Food Safety & Temperature (6-20)
  if (codeNum >= 6 && codeNum <= 20) {
    return { icon: Thermometer, emoji: "🌡️", label: "Food Safety", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Contamination Prevention (21-31)
  if (codeNum >= 21 && codeNum <= 31) {
    return { icon: Droplets, emoji: "🧼", label: "Contamination", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Food Storage & Labeling (32-37)
  if (codeNum >= 32 && codeNum <= 37) {
    return { icon: Utensils, emoji: "🏷️", label: "Storage/Labeling", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Pests & Rodents (38)
  if (codeNum === 38) {
    return { icon: Bug, emoji: "🐀", label: "Pests/Rodents", bgColor: "bg-red-100", textColor: "text-red-700" };
  }
  
  // Chemical Safety (39-42)
  if (codeNum >= 39 && codeNum <= 42) {
    return { icon: AlertTriangle, emoji: "⚠️", label: "Chemical Safety", bgColor: "bg-amber-100", textColor: "text-amber-700" };
  }
  
  // Equipment & Facilities (43-58)
  if (codeNum >= 43 && codeNum <= 58) {
    return { icon: Building2, emoji: "🏢", label: "Facilities", bgColor: "bg-blue-100", textColor: "text-blue-700" };
  }
  
  // Prior Violations (59-60)
  if (codeNum >= 59) {
    return { icon: FileWarning, emoji: "📋", label: "Prior Violations", bgColor: "bg-gray-100", textColor: "text-gray-700" };
  }
  
  return { icon: AlertTriangle, emoji: "⚠️", label: "Other", bgColor: "bg-gray-100", textColor: "text-gray-700" };
}

export function ViolationsAccordion({ inspections }: ViolationsAccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatus = (result: string): "pass" | "conditional" | "fail" => {
    if (result.toLowerCase().includes("fail")) return "fail";
    if (result.toLowerCase().includes("condition")) return "conditional";
    return "pass";
  };

  const getCriticalCount = (violations: Violation[]) => {
    return violations.filter(v => v.is_critical).length;
  };
  
  return (
    <div className="space-y-3">
      {inspections.map((inspection) => {
        const criticalCount = getCriticalCount(inspection.violations);
        const isOpen = openItems.has(inspection.id);
        
        return (
          <div
            key={inspection.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => toggleItem(inspection.id)}
              className="w-full px-4 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <span className="font-bold text-gray-900">
                    {new Date(inspection.inspection_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">{inspection.inspection_type}</span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={getStatus(inspection.results)} size="sm" />
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {inspection.violations.length} violation{inspection.violations.length !== 1 ? "s" : ""}
                  </span>
                  {criticalCount > 0 && (
                    <span className="text-sm text-red-600 bg-red-100 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      🚨 {criticalCount} critical
                    </span>
                  )}
                </div>
              </div>
              
              {isOpen ? (
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
              )}
            </button>
            
            {/* Content */}
            {isOpen && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                {inspection.violations.length > 0 ? (
                  <div className="space-y-3">
                    {inspection.violations.map((violation) => {
                      const category = getViolationCategory(violation.violation_code);
                      
                      return (
                        <div
                          key={violation.id}
                          className={`p-4 rounded-xl border-2 ${
                            violation.is_critical 
                              ? "border-red-300 bg-red-50" 
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          {/* Header with category and critical badge */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${category.bgColor} ${category.textColor} flex items-center gap-1`}>
                              {category.emoji} {category.label}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-300 text-gray-600">
                              Code {violation.violation_code}
                            </span>
                            {violation.is_critical && (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500 text-white flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                CRITICAL
                              </span>
                            )}
                          </div>
                          
                          {/* Violation description */}
                          <p className="font-medium text-sm text-gray-800 mb-2">
                            {violation.violation_description}
                          </p>
                          
                          {/* Inspector comment */}
                          {violation.violation_comment && (
                            <div className="bg-white rounded-lg p-3 mt-3 border border-gray-200">
                              <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">
                                Inspector&apos;s Note
                              </p>
                              <p className="text-sm text-gray-700">
                                {violation.violation_comment}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <span className="text-3xl mb-2 block">✅</span>
                    <p className="font-medium">No violations found during this inspection</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
