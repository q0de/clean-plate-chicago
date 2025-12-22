"use client";

import { Chip } from "@heroui/react";
import { Check, AlertTriangle, X, SlidersHorizontal } from "lucide-react";

type FilterValue = "pass" | "conditional" | "fail";

interface FilterChipsProps {
  selected: FilterValue[];
  onChange: (selected: FilterValue[]) => void;
  onFiltersClick: () => void;
}

const filters = [
  { value: "pass" as const, label: "Pass", icon: Check, color: "success" as const },
  { value: "conditional" as const, label: "Conditional", icon: AlertTriangle, color: "warning" as const },
  { value: "fail" as const, label: "Fail", icon: X, color: "danger" as const },
] as const;

export function FilterChips({ selected, onChange, onFiltersClick }: FilterChipsProps) {
  const toggleFilter = (value: FilterValue) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selected.includes(filter.value);
        
        return (
          <Chip
            key={filter.value}
            variant={isSelected ? "solid" : "flat"}
            color={isSelected ? filter.color : "default"}
            startContent={<Icon className="w-3.5 h-3.5" />}
            classNames={{
              base: "cursor-pointer min-w-fit",
              content: "font-medium",
            }}
            onClick={() => toggleFilter(filter.value)}
          >
            {filter.label}
          </Chip>
        );
      })}
      
      <Chip
        variant="bordered"
        startContent={<SlidersHorizontal className="w-3.5 h-3.5" />}
        classNames={{
          base: "cursor-pointer min-w-fit",
          content: "font-medium",
        }}
        onClick={onFiltersClick}
      >
        Filters
      </Chip>
    </div>
  );
}







