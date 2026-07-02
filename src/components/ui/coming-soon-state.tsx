import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export interface ComingSoonStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  moduleName: string;
  /** "coming-soon": not built yet. "not-enabled": built, but not enabled for this building. */
  mode?: "coming-soon" | "not-enabled";
  description?: string;
  /** e.g. "Contact Meridian Strata Group to enable this module." */
  footnote?: string;
}

/**
 * Polished shell for registered-but-disabled modules. Disabled modules must
 * never look broken — this is the only thing they are allowed to render.
 */
export function ComingSoonState({
  icon: Icon,
  moduleName,
  mode = "coming-soon",
  description,
  footnote,
  className,
  ...props
}: ComingSoonStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-edge",
        "bg-surface px-8 py-16 text-center shadow-card",
        className
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-5 flex size-12 items-center justify-center rounded-card bg-accent-subtle">
          <Icon aria-hidden className="size-5 text-accent-text" />
        </div>
      )}
      <Badge tone="accent">{mode === "coming-soon" ? "Coming soon" : "Not enabled"}</Badge>
      <h3 className="mt-3 text-title-2 text-fg">{moduleName}</h3>
      <p className="mt-2 max-w-md text-body text-fg-secondary">
        {description ??
          (mode === "coming-soon"
            ? `${moduleName} is on the roadmap and will appear here when it launches.`
            : `${moduleName} isn’t enabled for this building.`)}
      </p>
      {footnote && <p className="mt-4 text-body-sm text-fg-muted">{footnote}</p>}
    </div>
  );
}
