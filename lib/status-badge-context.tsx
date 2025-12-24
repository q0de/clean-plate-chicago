"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface StatusBadgeConfig {
  showViolationCount: boolean;
  showViolationThemes: boolean;
  maxThemesToShow: number;
}

interface StatusBadgeContextType {
  config: StatusBadgeConfig;
  setConfig: (config: Partial<StatusBadgeConfig>) => void;
}

const defaultConfig: StatusBadgeConfig = {
  showViolationCount: true,
  showViolationThemes: true,
  maxThemesToShow: 2,
};

const StatusBadgeContext = createContext<StatusBadgeContextType | undefined>(undefined);

export function StatusBadgeProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<StatusBadgeConfig>(defaultConfig);

  const setConfig = (newConfig: Partial<StatusBadgeConfig>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
  };

  return (
    <StatusBadgeContext.Provider value={{ config, setConfig }}>
      {children}
    </StatusBadgeContext.Provider>
  );
}

export function useStatusBadge() {
  const context = useContext(StatusBadgeContext);
  if (context === undefined) {
    throw new Error("useStatusBadge must be used within a StatusBadgeProvider");
  }
  return context;
}

