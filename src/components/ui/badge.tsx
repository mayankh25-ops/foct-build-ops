import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "critical" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-hover text-fg-secondary",
  accent: "bg-accent-subtle text-accent-text",
  success: "bg-success-subtle text-success-text",
  warning: "bg-warning-subtle text-warning-text",
  critical: "bg-critical-subtle text-critical-text",
  info: "bg-info-subtle text-info-text",
};

const dots: Record<Tone, string> = {
  neutral: "bg-edge-strong",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-critical",
  info: "bg-info",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-caption font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

/** Pill with a status dot — shift states, check-in status, connection health. */
export function StatusPill({ tone = "neutral", className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-caption font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      <span aria-hidden className={cn("size-2 rounded-pill", dots[tone])} />
      {children}
    </span>
  );
}
