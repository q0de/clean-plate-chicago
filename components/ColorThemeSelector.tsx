"use client";

import React from "react";
import { Palette, Check, X, AlertTriangle } from "lucide-react";
import { useColorTheme, colorThemes, ColorThemeKey } from "@/lib/color-theme-context";

export function ColorThemeSelector() {
  const { theme, setTheme, colors } = useColorTheme();
  const isBadgeStyle = colors.style === "badge";

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-72">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Color Theme</span>
        </div>
        
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ColorThemeKey)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-3"
        >
          <optgroup label="Banner Styles">
            {Object.entries(colorThemes).filter(([, t]) => t.style === "banner").map(([key, t]) => (
              <option key={key} value={key}>
                {t.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Badge Styles">
            {Object.entries(colorThemes).filter(([, t]) => t.style === "badge").map(([key, t]) => (
              <option key={key} value={key}>
                {t.name}
              </option>
            ))}
          </optgroup>
        </select>

        {/* Preview - show badge or banner style */}
        {isBadgeStyle ? (
          <div className="relative rounded-lg overflow-hidden h-16 bg-gradient-to-br from-amber-200 to-orange-300">
            {/* Simulated image background */}
            <div className="absolute inset-0 opacity-60 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%225%22%20fill%3D%22%23fff%22%20opacity%3D%220.3%22%2F%3E%3C%2Fsvg%3E')]" />
            {/* Overlay badges */}
            <div className="absolute inset-x-0 top-0 p-2 flex items-start justify-between">
              <div className={`${colors.pass.bg} px-2 py-1 rounded-full flex items-center gap-1 shadow-md`}>
                <Check className={`w-3 h-3 ${colors.pass.text}`} />
                <span className={`text-[10px] font-bold ${colors.pass.text}`}>PASS</span>
              </div>
              <div className={`${colors.dateBadge.bg} px-2 py-1 rounded-full shadow-md`}>
                <span className={`text-[10px] font-medium ${colors.dateBadge.text}`}>Dec 21</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <div className={`${colors.pass.bg} px-3 py-1.5 rounded-lg flex items-center gap-1`}>
              <Check className={`w-4 h-4 ${colors.pass.text}`} />
              <span className={`text-xs font-bold ${colors.pass.text}`}>PASS</span>
            </div>
            <div className={`${colors.conditional.bg} px-2 py-1.5 rounded-lg flex items-center gap-1`}>
              <AlertTriangle className={`w-4 h-4 ${colors.conditional.text}`} />
            </div>
            <div className={`${colors.fail.bg} px-3 py-1.5 rounded-lg flex items-center gap-1`}>
              <X className={`w-4 h-4 ${colors.fail.text}`} />
              <span className={`text-xs font-bold ${colors.fail.text}`}>FAIL</span>
            </div>
          </div>
        )}
        
        <p className="text-[10px] text-gray-400 text-center mt-2">
          {isBadgeStyle ? "Badge style with dark date" : "Full-width banner style"}
        </p>
      </div>
    </div>
  );
}

