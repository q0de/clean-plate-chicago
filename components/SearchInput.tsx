"use client";

import { Search, MapPin, Loader2 } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationClick?: () => void;
  onSubmit?: () => void;
  isLoadingLocation?: boolean;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ 
  value, 
  onChange, 
  onLocationClick,
  onSubmit,
  isLoadingLocation = false,
  placeholder = "Search restaurants...",
  className = ""
}: SearchInputProps) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 transition-all shadow-sm ${className}`}>
      <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400 text-base"
      />
      {onLocationClick && (
        <button
          onClick={onLocationClick}
          disabled={isLoadingLocation}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Use my location"
        >
          {isLoadingLocation ? (
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5 text-gray-400 hover:text-emerald-500" />
          )}
        </button>
      )}
    </div>
  );
}
