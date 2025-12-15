"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type StatusBadgeStyle = "icon-only" | "icon-text";

interface StatusBadgeContextType {
  style: StatusBadgeStyle;
  setStyle: (style: StatusBadgeStyle) => void;
}

const StatusBadgeContext = createContext<StatusBadgeContextType | undefined>(undefined);

const STORAGE_KEY = "cleanplate-status-badge-style";

export function StatusBadgeProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<StatusBadgeStyle>("icon-text");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === "icon-only" || stored === "icon-text")) {
      setStyleState(stored as StatusBadgeStyle);
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  const setStyle = (newStyle: StatusBadgeStyle) => {
    setStyleState(newStyle);
    localStorage.setItem(STORAGE_KEY, newStyle);
  };

  // Prevent hydration mismatch by not rendering until hydrated
  if (!isHydrated) {
    return <>{children}</>;
  }

  return (
    <StatusBadgeContext.Provider value={{ style, setStyle }}>
      {children}
    </StatusBadgeContext.Provider>
  );
}

export function useStatusBadgeStyle() {
  const context = useContext(StatusBadgeContext);
  if (context === undefined) {
    // Return default if not in provider (e.g., during SSR)
    return { style: "icon-text" as StatusBadgeStyle, setStyle: () => {} };
  }
  return context;
}

