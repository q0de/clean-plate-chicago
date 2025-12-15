"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type DisplayMode = "A" | "B" | "C" | "D" | "E";

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  A: "Current (Separate)",
  B: "Unified Card",
  C: "Status-Colored Score",
  D: "Dual Indicator",
  E: "Contextual Labels",
};

export const DISPLAY_MODE_DESCRIPTIONS: Record<DisplayMode, string> = {
  A: "Status badge and score ring shown separately with independent colors",
  B: "Single card combining both metrics with result-based background color",
  C: "Score ring color matches inspection result (green if passed)",
  D: "Score ring with embedded result icon overlay",
  E: "Both metrics with explanatory labels beneath each",
};

interface DisplayModeContextType {
  mode: DisplayMode;
  setMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined);

const STORAGE_KEY = "cleanplate-display-mode";

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DisplayMode>("A");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["A", "B", "C", "D", "E"].includes(stored)) {
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
