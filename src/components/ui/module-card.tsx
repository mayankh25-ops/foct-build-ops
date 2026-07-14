import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type ModuleStatus =
  | "enabled"
  | "not-enabled"
  | "coming-soon"
  | "requires-pro"
  | "requires-automation-pro";

const statusMeta: Record<ModuleStatus, { label: string; tone: "success" | "neutral" | "accent" | "info" }> = {
  enabled: { label: "Enabled", tone: "success" },
  "not-enabled": { label: "Not enabled for this building", tone: "neutral" },
  "coming-soon": { label: "Coming soon", tone: "accent" },
  "requires-pro": { label: "Requires BuildingOps Pro", tone: "info" },
  "requires-automation-pro": { label: "Requires Automation Pro", tone: "info" },
};

export interface ModuleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  name: string;
  description: string;
  status: ModuleStatus;
}

/** Module packaging tile — disabled modules look intentional, never broken. */
export function ModuleCard({
  icon: Icon,
  name,
  description,
  status,
  className,
  ...props
}: ModuleCardProps) {
  const meta = statusMeta[status];
  const enabled = status === "enabled";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-card border border-edge bg-surface p-6 shadow-card",
        "transition-shadow duration-150",
        enabled && "hover:shadow-raised",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-11 items-center justify-center rounded-control",
            enabled ? "bg-accent-subtle text-accent-text" : "bg-hover text-fg-muted"
          )}
        >
          <Icon className="size-5" />
        </span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div className="flex-1">
        <h3 className={cn("text-title-3", enabled ? "text-fg" : "text-fg-secondary")}>{name}</h3>
        <p className="mt-1.5 text-body-sm text-fg-muted">{description}</p>
      </div>
      <div className="flex items-center gap-1.5 text-body-sm font-medium">
        {enabled ? (
          <span className="flex items-center gap-1.5 text-accent-text">
            Open <ArrowRight aria-hidden className="size-4" />
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-fg-muted">
            <Lock aria-hidden className="size-3.5" />
            {status === "coming-soon" ? "On the roadmap" : "Talk to your building manager"}
          </span>
        )}
      </div>
    </div>
  );
}
