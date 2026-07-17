import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  /** Small line above the title, e.g. module or section name. */
  eyebrow?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-wrap items-end justify-between gap-4 pb-8", className)}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="pb-1.5 text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-title-1 text-fg">{title}</h1>
        {description && <p className="mt-1.5 text-body text-fg-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
