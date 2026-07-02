import * as React from "react";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Heading row for a page section — between PageHeader and card content. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3 pb-4", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-title-2 text-fg">{title}</h2>
        {description && <p className="mt-1 text-body-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
