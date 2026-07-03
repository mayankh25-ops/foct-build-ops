import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "critical" | "info";

const iconWells: Record<Tone, string> = {
  neutral: "bg-hover text-fg-secondary",
  accent: "bg-accent-subtle text-accent-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  critical: "bg-critical-subtle text-critical-text",
  info: "bg-info-subtle text-info-text",
};

const valueTones: Record<Tone, string> = {
  neutral: "text-fg",
  accent: "text-fg",
  success: "text-fg",
  warning: "text-warning-text",
  critical: "text-critical-text",
  info: "text-fg",
};

export interface MetricTrend {
  direction: "up" | "down";
  label: string;
  /** Whether this movement is good news — drives the chip colour. */
  positive?: boolean;
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  /** Second line under the label block: "2 due by 07:00"… */
  context?: string;
  icon?: LucideIcon;
  /** Comparison chip next to the value: ↑ +2 vs last Wed */
  trend?: MetricTrend;
  /** Colours the icon well; warning/critical also colour the value. */
  tone?: Tone;
}

/** Dashboard stat, TailAdmin-style: icon well, small label, big bold number, trend chip. */
export function MetricCard({
  label,
  value,
  context,
  icon: Icon,
  trend,
  tone = "neutral",
  className,
  ...props
}: MetricCardProps) {
  const TrendIcon = trend?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-card border border-edge bg-surface p-6 shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-control",
              iconWells[tone]
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
        {trend && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-pill px-2.5 py-1 text-caption font-medium",
              trend.positive === false
                ? "bg-critical-subtle text-critical-text"
                : "bg-success-subtle text-success-text"
            )}
          >
            <TrendIcon aria-hidden className="size-3.5" />
            {trend.label}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-body-sm text-fg-muted">{label}</p>
        <p
          className={cn(
            "mt-1 font-display text-display [font-variant-numeric:tabular-nums]",
            valueTones[tone]
          )}
        >
          {value}
        </p>
        {context && <p className="mt-1 truncate text-caption text-fg-muted">{context}</p>}
      </div>
    </div>
  );
}
