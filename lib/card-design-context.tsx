"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface CardDesignConfig {
  // Card dimensions
  cardWidth: number; // in pixels
  
  // Icon sizes
  statusIconSize: number; // in pixels
  violationIconSize: number; // in pixels
  locationIconSize: number; // in pixels
  scoreIconSize: number; // in pixels (circular score display)
  
  // Typography sizes
  statusTextSize: number; // in pixels
  restaurantNameSize: number; // in pixels
  addressTextSize: number; // in pixels
  violationTextSize: number; // in pixels
  dateTextSize: number; // in pixels
  scoreTextSize: number; // in pixels
  
  // Section heights
  statusBannerHeight: number; // in pixels
  imageSectionHeight: number; // in pixels
  contentPadding: number; // in pixels
  
  // Badge styling
  badgeBorderThickness: number; // in pixels
  badgeBorderColor: string; // hex color or Tailwind class
  
  // Chips section styling
  chipsBgColor: string; // hex color for individual chips
  chipsSectionBgColor: string; // hex color for section background
  
  // Hero noise effect
  heroNoiseOpacity: number; // 0-100 percentage
  heroNoiseEnabled: boolean;
  heroNoiseSpeed: number; // animation duration in seconds (lower = faster)
  
  // Logo font
  logoFont: string; // font family name
  logoColor: string; // hex color
  logoSize: number; // text size in pixels
  logoIconSize: number; // icon size in pixels
  
  // Header styling
  headerPadding: number; // vertical padding in pixels
  heroWatermarkOpacity: number; // 0-1 opacity for watermark
  heroWatermarkSize: number; // size in pixels
}

const defaultConfig: CardDesignConfig = {
  cardWidth: 268,
  statusIconSize: 19.4,
  violationIconSize: 17,
  locationIconSize: 17,
  scoreIconSize: 48,
  statusTextSize: 14,
  restaurantNameSize: 16,
  addressTextSize: 12,
  violationTextSize: 12,
  dateTextSize: 11,
  scoreTextSize: 14,
  statusBannerHeight: 40,
  imageSectionHeight: 130,
  contentPadding: 15,
  badgeBorderThickness: 2.5,
  badgeBorderColor: "#15803D",
  chipsBgColor: "#ededed",
  chipsSectionBgColor: "transparent",
  heroNoiseOpacity: 4,
  heroNoiseEnabled: true,
  heroNoiseSpeed: 1.7,
  logoFont: "default",
  logoColor: "#047857", // emerald-700
  logoSize: 24, // text size in pixels
  logoIconSize: 120, // icon size in pixels
  headerPadding: 12, // vertical padding in pixels
  heroWatermarkOpacity: 0.12, // opacity for watermark (0-1)
  heroWatermarkSize: 400, // watermark size in pixels
};

interface CardDesignContextType {
  config: CardDesignConfig;
  updateConfig: (updates: Partial<CardDesignConfig>) => void;
  resetConfig: () => void;
  saveConfig: () => void;
}

const CardDesignContext = createContext<CardDesignContextType | undefined>(undefined);

const STORAGE_KEY = "cardDesignConfig";

export function CardDesignProvider({ children }: { children: ReactNode }) {
  // Load from localStorage on mount, fallback to default
  const [config, setConfig] = useState<CardDesignConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Merge with default to ensure all keys exist
          return { ...defaultConfig, ...parsed };
        }
      } catch (error) {
        console.error("Failed to load card design config from localStorage:", error);
      }
    }
    return defaultConfig;
  });

  const updateConfig = (updates: Partial<CardDesignConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const saveConfig = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (error) {
        console.error("Failed to save card design config to localStorage:", error);
        throw error;
      }
    }
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Failed to remove card design config from localStorage:", error);
      }
    }
  };

  return (
    <CardDesignContext.Provider value={{ config, updateConfig, resetConfig, saveConfig }}>
      {children}
    </CardDesignContext.Provider>
  );
}

export function useCardDesign() {
  const context = useContext(CardDesignContext);
  if (!context) {
    throw new Error("useCardDesign must be used within CardDesignProvider");
  }
  return context;
}

