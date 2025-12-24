"use client";

import React, { useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";

// Different color theme options
const colorThemes = {
  original: {
    name: "Original (Bold)",
    pass: { bg: "bg-emerald-600", text: "text-white" },
    conditional: { bg: "bg-yellow-500", text: "text-amber-950" },
    fail: { bg: "bg-red-600", text: "text-white" },
  },
  softPastel: {
    name: "Soft Pastel",
    pass: { bg: "bg-emerald-400", text: "text-white" },
    conditional: { bg: "bg-amber-300", text: "text-amber-900" },
    fail: { bg: "bg-red-400", text: "text-white" },
  },
  muted: {
    name: "Muted",
    pass: { bg: "bg-teal-400", text: "text-white" },
    conditional: { bg: "bg-amber-400", text: "text-amber-950" },
    fail: { bg: "bg-rose-400", text: "text-white" },
  },
  sage: {
    name: "Sage & Terracotta",
    pass: { bg: "bg-green-500", text: "text-white" },
    conditional: { bg: "bg-orange-300", text: "text-orange-900" },
    fail: { bg: "bg-orange-500", text: "text-white" },
  },
  ocean: {
    name: "Ocean",
    pass: { bg: "bg-cyan-500", text: "text-white" },
    conditional: { bg: "bg-sky-300", text: "text-sky-900" },
    fail: { bg: "bg-indigo-400", text: "text-white" },
  },
  warm: {
    name: "Warm Earth",
    pass: { bg: "bg-lime-500", text: "text-white" },
    conditional: { bg: "bg-yellow-300", text: "text-yellow-900" },
    fail: { bg: "bg-orange-500", text: "text-white" },
  },
  minimal: {
    name: "Minimal (Low Contrast)",
    pass: { bg: "bg-emerald-200", text: "text-emerald-800" },
    conditional: { bg: "bg-amber-200", text: "text-amber-800" },
    fail: { bg: "bg-red-200", text: "text-red-800" },
  },
  professional: {
    name: "Professional",
    pass: { bg: "bg-slate-600", text: "text-emerald-300" },
    conditional: { bg: "bg-slate-500", text: "text-amber-300" },
    fail: { bg: "bg-slate-700", text: "text-red-300" },
  },
  nature: {
    name: "Nature",
    pass: { bg: "bg-green-600", text: "text-white" },
    conditional: { bg: "bg-yellow-400", text: "text-yellow-900" },
    fail: { bg: "bg-red-500", text: "text-white" },
  },
};

export function ColorThemePreview() {
  const [selectedTheme, setSelectedTheme] = useState<string>("softPastel");

  return (
    <div className="p-6 bg-gray-100 rounded-xl max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Color Theme Preview</h2>
      
      {/* Theme Selector Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Theme:
        </label>
        <select
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value)}
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          {Object.entries(colorThemes).map(([key, theme]) => (
            <option key={key} value={key}>
              {theme.name}
            </option>
          ))}
        </select>
      </div>

      {/* Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Pass Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className={`${colorThemes[selectedTheme as keyof typeof colorThemes].pass.bg} px-4 py-3`}>
            <div className="flex items-center gap-2">
              <Check className={`w-5 h-5 ${colorThemes[selectedTheme as keyof typeof colorThemes].pass.text}`} />
              <span className={`font-bold ${colorThemes[selectedTheme as keyof typeof colorThemes].pass.text}`}>
                PASS
              </span>
              <span className={`ml-auto text-sm ${colorThemes[selectedTheme as keyof typeof colorThemes].pass.text} opacity-80`}>
                Dec 18, 2025
              </span>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold">Sample Restaurant</h3>
            <p className="text-sm text-gray-500">123 Main Street</p>
          </div>
        </div>

        {/* Conditional Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className={`${colorThemes[selectedTheme as keyof typeof colorThemes].conditional.bg} px-4 py-3`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${colorThemes[selectedTheme as keyof typeof colorThemes].conditional.text}`} />
              <span className={`font-bold ${colorThemes[selectedTheme as keyof typeof colorThemes].conditional.text}`}>
                CONDITIONAL
              </span>
              <span className={`ml-auto text-sm ${colorThemes[selectedTheme as keyof typeof colorThemes].conditional.text} opacity-80`}>
                Dec 15, 2025
              </span>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold">Sample Restaurant</h3>
            <p className="text-sm text-gray-500">456 Oak Avenue</p>
          </div>
        </div>

        {/* Fail Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className={`${colorThemes[selectedTheme as keyof typeof colorThemes].fail.bg} px-4 py-3`}>
            <div className="flex items-center gap-2">
              <X className={`w-5 h-5 ${colorThemes[selectedTheme as keyof typeof colorThemes].fail.text}`} />
              <span className={`font-bold ${colorThemes[selectedTheme as keyof typeof colorThemes].fail.text}`}>
                FAILED
              </span>
              <span className={`ml-auto text-sm ${colorThemes[selectedTheme as keyof typeof colorThemes].fail.text} opacity-80`}>
                Dec 21, 2025
              </span>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold">Sample Restaurant</h3>
            <p className="text-sm text-gray-500">789 Elm Street</p>
          </div>
        </div>
      </div>

      {/* All Themes Grid */}
      <h3 className="text-lg font-semibold mb-3">All Theme Options:</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(colorThemes).map(([key, theme]) => (
          <button
            key={key}
            onClick={() => setSelectedTheme(key)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedTheme === key
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className="font-medium text-sm mb-2">{theme.name}</p>
            <div className="flex gap-1">
              <div className={`${theme.pass.bg} w-8 h-6 rounded flex items-center justify-center`}>
                <Check className={`w-4 h-4 ${theme.pass.text}`} />
              </div>
              <div className={`${theme.conditional.bg} w-8 h-6 rounded flex items-center justify-center`}>
                <AlertTriangle className={`w-4 h-4 ${theme.conditional.text}`} />
              </div>
              <div className={`${theme.fail.bg} w-8 h-6 rounded flex items-center justify-center`}>
                <X className={`w-4 h-4 ${theme.fail.text}`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Code Output */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-400 text-sm mb-2">Selected theme code:</p>
        <pre className="text-green-400 text-xs overflow-x-auto">
{`// Theme: ${colorThemes[selectedTheme as keyof typeof colorThemes].name}
pass: "${colorThemes[selectedTheme as keyof typeof colorThemes].pass.bg}"
conditional: "${colorThemes[selectedTheme as keyof typeof colorThemes].conditional.bg}"  
fail: "${colorThemes[selectedTheme as keyof typeof colorThemes].fail.bg}"`}
        </pre>
      </div>
    </div>
  );
}

