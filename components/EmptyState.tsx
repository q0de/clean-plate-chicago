"use client";

import { Button } from "@heroui/react";
import { 
  Search, 
  MapPin, 
  MapPinOff, 
  WifiOff,
  Building
} from "lucide-react";

type EmptyStateType = "no-results" | "no-area" | "location-denied" | "network-error" | "empty-neighborhood";

interface EmptyStateProps {
  type: EmptyStateType;
  query?: string;
  onAction?: () => void;
}

const config = {
  "no-results": {
    icon: Search,
    title: "No restaurants found",
    getMessage: (query?: string) => query 
      ? `No results for "${query}"` 
      : "Try a different search",
    action: "Clear search",
  },
  "no-area": {
    icon: MapPin,
    title: "No restaurants in this area",
    getMessage: () => "Try zooming out or searching another location",
    action: "Zoom out",
  },
  "location-denied": {
    icon: MapPinOff,
    title: "Location access needed",
    getMessage: () => "Enable location to use 'Near Me' or search manually",
    action: "Search manually",
  },
  "network-error": {
    icon: WifiOff,
    title: "Couldn't load restaurants",
    getMessage: () => "Check your connection and try again",
    action: "Retry",
  },
  "empty-neighborhood": {
    icon: Building,
    title: "No data for this neighborhood",
    getMessage: () => "We don't have inspection data for this area yet",
    action: "Explore nearby",
  },
};

export function EmptyState({ type, query, onAction }: EmptyStateProps) {
  const { icon: Icon, title, getMessage, action } = config[type];
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-default-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-default-900 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-default-500 mb-6 max-w-xs">
        {getMessage(query)}
      </p>
      
      {onAction && (
        <Button
          color="primary"
          variant="flat"
          onPress={onAction}
        >
          {action}
        </Button>
      )}
    </div>
  );
}







