"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  /** Force active state (when href matching isn't enough, e.g. previews). */
  active?: boolean;
  /** Registered-but-disabled modules render dimmed with a lock + status word. */
  disabled?: boolean;
  /** Word shown on disabled items: "Soon", "Locked", "Pro"… */
  disabledLabel?: string;
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

/**
 * Deep-toned navigation rail (FOCT Premium Operations UI). Uses the
 * --sidebar-* token family so every theme keeps its own dark rail.
 */
export function Sidebar({
  productName = "FOCT BuildingOps",
  buildingName,
  sections,
  footer,
  className,
  ...props
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full w-[264px] shrink-0 flex-col bg-sidebar text-sidebar-fg",
        className
      )}
      {...props}
    >
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-control bg-sidebar-hover"
          >
            <span className="size-3 rounded-pill bg-brand" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-body font-semibold tracking-tight text-sidebar-fg">
              {productName}
            </p>
            {buildingName && (
              <p className="mt-0.5 text-caption text-sidebar-muted">{buildingName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {sections.map((section, i) => (
          <div key={section.title ?? i} className={cn(i > 0 && "mt-7")}>
            {section.title && (
              <p className="px-3 pb-2 text-caption font-medium text-sidebar-muted">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive = item.active ?? (item.href ? pathname === item.href : false);
                const inner = (
                  <>
                    <item.icon aria-hidden className="size-[18px] shrink-0" />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {item.disabled && (
                      <span className="flex items-center gap-1.5 text-caption text-sidebar-muted">
                        <Lock aria-hidden className="size-3" />
                        {item.disabledLabel ?? "Soon"}
                      </span>
                    )}
                  </>
                );
                const itemClass = cn(
                  "relative flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-body-sm",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-hover font-medium text-sidebar-fg " +
                        "before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] " +
                        "before:rounded-pill before:bg-sidebar-active"
                    : item.disabled
                      ? "cursor-default text-sidebar-muted opacity-70"
                      : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
                );

                return (
                  <li key={item.label}>
                    {item.href && !item.disabled ? (
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={itemClass}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={item.onSelect}
                        disabled={item.disabled}
                        aria-current={isActive ? "page" : undefined}
                        className={itemClass}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {footer && (
        <div className="border-t border-sidebar-border px-6 py-5">{footer}</div>
      )}
    </nav>
  );
}
