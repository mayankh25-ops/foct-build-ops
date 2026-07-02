import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-edge",
        "bg-surface px-8 py-14 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-pill bg-hover">
          <Icon aria-hidden className="size-5 text-fg-muted" />
        </div>
      )}
      <h3 className="text-title-3 text-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-body-sm text-fg-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
