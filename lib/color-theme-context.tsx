"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

// Color theme definitions
export const colorThemes = {
  original: {
    name: "Original (Bold)",
    style: "banner" as const,
    pass: { bg: "bg-emerald-600", text: "text-white" },
    conditional: { bg: "bg-yellow-500", text: "text-amber-950" },
    fail: { bg: "bg-red-600", text: "text-white" },
    closed: { bg: "bg-gray-500", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  softPastel: {
    name: "Soft Pastel",
    style: "banner" as const,
    pass: { bg: "bg-emerald-400", text: "text-white" },
    conditional: { bg: "bg-amber-300", text: "text-amber-900" },
    fail: { bg: "bg-red-400", text: "text-white" },
    closed: { bg: "bg-gray-400", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  muted: {
    name: "Muted",
    style: "banner" as const,
    pass: { bg: "bg-teal-400", text: "text-white" },
    conditional: { bg: "bg-amber-400", text: "text-amber-950" },
    fail: { bg: "bg-rose-400", text: "text-white" },
    closed: { bg: "bg-gray-400", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  badge: {
    name: "Badge Style",
    style: "badge" as const,
    pass: { bg: "bg-emerald-500", text: "text-white" },
    conditional: { bg: "bg-amber-500", text: "text-white" },
    fail: { bg: "bg-red-500", text: "text-white" },
    closed: { bg: "bg-gray-500", text: "text-white" },
    dateBadge: { bg: "bg-gray-800", text: "text-white" },
  },
  badgeSoft: {
    name: "Badge Soft",
    style: "badge" as const,
    pass: { bg: "bg-emerald-100", text: "text-emerald-700" },
    conditional: { bg: "bg-amber-100", text: "text-amber-700" },
    fail: { bg: "bg-red-100", text: "text-red-700" },
    closed: { bg: "bg-gray-100", text: "text-gray-700" },
    dateBadge: { bg: "bg-gray-900", text: "text-white" },
  },
  badgeOutline: {
    name: "Badge Outline",
    style: "badge" as const,
    pass: { bg: "bg-white border-2 border-emerald-500", text: "text-emerald-600" },
    conditional: { bg: "bg-white border-2 border-amber-500", text: "text-amber-600" },
    fail: { bg: "bg-white border-2 border-red-500", text: "text-red-600" },
    closed: { bg: "bg-white border-2 border-gray-400", text: "text-gray-600" },
    dateBadge: { bg: "bg-gray-800", text: "text-white" },
  },
  sage: {
    name: "Sage & Terracotta",
    style: "banner" as const,
    pass: { bg: "bg-green-500", text: "text-white" },
    conditional: { bg: "bg-orange-300", text: "text-orange-900" },
    fail: { bg: "bg-orange-500", text: "text-white" },
    closed: { bg: "bg-gray-500", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  ocean: {
    name: "Ocean",
    style: "banner" as const,
    pass: { bg: "bg-cyan-500", text: "text-white" },
    conditional: { bg: "bg-sky-300", text: "text-sky-900" },
    fail: { bg: "bg-indigo-400", text: "text-white" },
    closed: { bg: "bg-slate-400", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  warm: {
    name: "Warm Earth",
    style: "banner" as const,
    pass: { bg: "bg-lime-500", text: "text-white" },
    conditional: { bg: "bg-yellow-300", text: "text-yellow-900" },
    fail: { bg: "bg-orange-500", text: "text-white" },
    closed: { bg: "bg-stone-400", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
  minimal: {
    name: "Minimal (Low Contrast)",
    style: "banner" as const,
    pass: { bg: "bg-emerald-200", text: "text-emerald-800" },
    conditional: { bg: "bg-amber-200", text: "text-amber-800" },
    fail: { bg: "bg-red-200", text: "text-red-800" },
    closed: { bg: "bg-gray-200", text: "text-gray-700" },
    dateBadge: { bg: "bg-gray-700", text: "text-white" },
  },
  professional: {
    name: "Professional",
    style: "banner" as const,
    pass: { bg: "bg-slate-600", text: "text-emerald-300" },
    conditional: { bg: "bg-slate-500", text: "text-amber-300" },
    fail: { bg: "bg-slate-700", text: "text-red-300" },
    closed: { bg: "bg-slate-400", text: "text-white" },
    dateBadge: { bg: "bg-black/30", text: "text-white" },
  },
  nature: {
    name: "Nature",
    style: "banner" as const,
    pass: { bg: "bg-green-600", text: "text-white" },
    conditional: { bg: "bg-yellow-400", text: "text-yellow-900" },
    fail: { bg: "bg-red-500", text: "text-white" },
    closed: { bg: "bg-stone-500", text: "text-white" },
    dateBadge: { bg: "bg-black/20", text: "text-white" },
  },
};

export type ColorThemeKey = keyof typeof colorThemes;

interface ColorThemeContextType {
  theme: ColorThemeKey;
  setTheme: (theme: ColorThemeKey) => void;
  colors: typeof colorThemes.original;
}

const ColorThemeContext = createContext<ColorThemeContextType | undefined>(undefined);

export function ColorThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ColorThemeKey>("softPastel");

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("colorTheme") as ColorThemeKey;
    if (saved && colorThemes[saved]) {
      setTheme(saved);
    }
  }, []);

  // Save to localStorage when changed
  const handleSetTheme = (newTheme: ColorThemeKey) => {
    setTheme(newTheme);
    localStorage.setItem("colorTheme", newTheme);
  };

  return (
    <ColorThemeContext.Provider value={{ 
      theme, 
      setTheme: handleSetTheme, 
      colors: colorThemes[theme] 
    }}>
      {children}
    </ColorThemeContext.Provider>
  );
}

export function useColorTheme() {
  const context = useContext(ColorThemeContext);
  if (!context) {
    // Return default if not in provider
    return {
      theme: "softPastel" as ColorThemeKey,
      setTheme: () => {},
      colors: colorThemes.softPastel,
    };
  }
  return context;
}

