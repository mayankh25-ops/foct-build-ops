import * as React from "react";
import type { LucideIcon } from "lucide-react";
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

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  /** Second line under the value: "2 due by 07:00", "↑ 3 vs last week"… */
  context?: string;
  icon?: LucideIcon;
  /** Colours the icon well; warning/critical also colour the value. */
  tone?: Tone;
}

/** Dashboard stat: big tabular number, small human label, optional context. */
export function MetricCard({
  label,
  value,
  context,
  icon: Icon,
  tone = "neutral",
  className,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-card border border-edge bg-surface p-6 shadow-card",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm font-medium text-fg-secondary">{label}</p>
        {Icon && (
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-control",
              iconWells[tone]
            )}
          >
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div>
        <p className={cn("font-mono text-display", valueTones[tone])}>{value}</p>
        {context && <p className="mt-1 text-body-sm text-fg-muted">{context}</p>}
      </div>
    </div>
  );
}
