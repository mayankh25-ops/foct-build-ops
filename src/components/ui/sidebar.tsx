"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Registered-but-disabled modules render dimmed with a "Soon" badge. */
  disabled?: boolean;
  onSelect?: () => void;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  productName?: string;
  buildingName?: string;
  sections: SidebarSection[];
  footer?: React.ReactNode;
}

/** App navigation shell. Fixed-width column; consumer owns the layout grid. */
export function Sidebar({
  productName = "FOCT BuildingOps",
  buildingName,
  sections,
  footer,
  className,
  ...props
}: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-edge bg-surface",
        className
      )}
      {...props}
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="size-2.5 rounded-pill bg-brand" />
          <span className="font-display text-body font-semibold tracking-tight text-fg">
            {productName}
          </span>
        </div>
        {buildingName && (
          <p className="mt-1 pl-5 text-caption text-fg-muted">{buildingName}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className={cn(i > 0 && "mt-6")}>
            {section.title && (
              <p className="px-2 pb-2 text-caption font-medium tracking-wide text-fg-muted uppercase">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={item.onSelect}
                    disabled={item.disabled}
                    aria-current={item.active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-body-sm",
                      "transition-colors duration-150",
                      item.active
                        ? "bg-accent-subtle font-medium text-accent-text"
                        : item.disabled
                          ? "cursor-default text-fg-disabled"
                          : "text-fg-secondary hover:bg-hover hover:text-fg"
                    )}
                  >
                    <item.icon aria-hidden className="size-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.disabled && <Badge tone="neutral">Soon</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {footer && <div className="border-t border-edge px-5 py-4">{footer}</div>}
    </nav>
  );
}
