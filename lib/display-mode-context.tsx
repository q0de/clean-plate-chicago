"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type DisplayMode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  A: "Current (Separate)",
  B: "Unified Card",
  C: "Status-Colored Score",
  D: "Dual Indicator",
  E: "Contextual Labels",
  F: "Dual Rings Side-by-Side",
  G: "Stacked with Labels",
  H: "Split Card Layout",
  I: "Dual Rings with Status Center",
  J: "Horizontal Comparison",
};

export const DISPLAY_MODE_DESCRIPTIONS: Record<DisplayMode, string> = {
  A: "Status badge and score ring shown separately with independent colors",
  B: "Single card combining both metrics with result-based background color",
  C: "Score ring color matches inspection result (green if passed)",
  D: "Score ring with embedded result icon overlay",
  E: "Both metrics with explanatory labels beneath each",
  F: "Two score rings displayed horizontally - Latest Inspection and CleanPlate",
  G: "Latest Inspection Score on top, CleanPlate Score below with labels",
  H: "Card divided vertically - Latest Inspection left, CleanPlate right",
  I: "Two rings with status badge positioned between them",
  J: "Both scores in horizontal bar layout with clear labels",
};

interface DisplayModeContextType {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined);

const STORAGE_KEY = "cleanplate-display-mode";

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>("J");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(stored)) {
      setModeState(stored as DisplayMode);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  const setMode = (newMode: DisplayMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  // Prevent hydration mismatch by not rendering until hydrated
  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <DisplayModeContext.Provider value={{ mode, setMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
}

export function useDisplayMode() {
  const context = useContext(DisplayModeContext);
  if (context === undefined) {
    // Return default if not in provider (e.g., during SSR)
    return { mode: "A" as DisplayMode, setMode: () => {} };
  }
  return context;
}
