"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/** Layout row for list filters: SearchInput, selects, segmented controls. */
export function FilterBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2.5 pb-5", className)}
      {...props}
    />
  );
}

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}

/** Calm pill-group toggle — view switching (Day / Week / Timeline). */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex rounded-control border border-edge bg-canvas p-0.5", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onValueChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "rounded-sm px-3.5 py-1.5 text-body-sm transition-colors duration-150",
            value === opt.value
              ? "bg-surface font-medium text-fg shadow-card"
              : "text-fg-muted hover:text-fg"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
