"use client";

import { Check, AlertTriangle, X } from "lucide-react";

type Status = "pass" | "conditional" | "fail";

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md" | "lg";
}

const statusConfig = {
  pass: {
    bgColor: "bg-emerald-500",
    textColor: "text-white",
    icon: Check,
    label: "PASSED",
    ariaLabel: "Passed inspection",
  },
  conditional: {
    bgColor: "bg-amber-500",
    textColor: "text-white",
    icon: AlertTriangle,
    label: "CONDITIONAL",
    ariaLabel: "Passed with conditions",
  },
  fail: {
    bgColor: "bg-red-500",
    textColor: "text-white",
    icon: X,
    label: "FAILED",
    ariaLabel: "Failed inspection",
  },
};

const sizeConfig = {
  sm: "text-xs px-2.5 py-1 gap-1",
  md: "text-sm px-3 py-1.5 gap-1.5",
  lg: "text-base px-4 py-2 gap-2",
};

const iconSizeConfig = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide rounded-full ${config.bgColor} ${config.textColor} ${sizeConfig[size]}`}
      aria-label={config.ariaLabel}
    >
      <Icon className={iconSizeConfig[size]} />
      {config.label}
    </span>
  );
}
