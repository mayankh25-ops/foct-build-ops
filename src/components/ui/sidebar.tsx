"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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

const COLLAPSE_KEY = "foct-sidebar-collapsed";

/**
 * Deep-toned navigation rail (FOCT Premium Operations UI). Uses the
 * --sidebar-* token family so every theme keeps its own dark rail.
 * Collapsible to an icon rail (state persists per device).
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
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* default expanded */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* best-effort */
      }
      return !c;
    });
  };

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-fg",
        "transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[240px]",
        className
      )}
      {...props}
    >
      <div className={cn("pt-7 pb-6", collapsed ? "px-4" : "px-6")}>
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-subtle"
          >
            <span className="size-3 rounded-pill bg-brand" />
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-body font-medium tracking-tight text-sidebar-fg">
                {productName}
              </p>
              {buildingName && (
                <p className="mt-0.5 truncate text-caption text-sidebar-muted">{buildingName}</p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-4 flex h-8 items-center justify-center gap-2 rounded-control text-caption text-sidebar-muted",
            "transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg",
            collapsed ? "w-full" : "w-full justify-start px-3"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4" />
          ) : (
            <>
              <PanelLeftClose aria-hidden className="size-4" /> Collapse
            </>
          )}
        </button>
      </div>

      <div className={cn("flex-1 overflow-y-auto pb-6", collapsed ? "px-3" : "px-3")}>
        {sections.map((section, i) => (
          <div key={section.title ?? i} className={cn(i > 0 && (collapsed ? "mt-5 border-t border-sidebar-border pt-5" : "mt-7"))}>
            {section.title && !collapsed && (
              <p className="px-3 pb-2 text-caption font-medium tracking-[0.08em] text-sidebar-muted uppercase">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive = item.active ?? (item.href ? pathname === item.href : false);
                const inner = (
                  <>
                    {/* 3px indicator on the active item (audit §7) */}
                    {isActive && !collapsed && (
                      <span
                        aria-hidden
                        className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-pill bg-accent"
                      />
                    )}
                    <item.icon
                      aria-hidden
                      className={cn("size-4 shrink-0", !isActive && "opacity-70")}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {item.disabled && (
                          <span className="rounded-pill border border-sidebar-border px-1.5 py-px text-[0.6875rem] leading-4 text-sidebar-muted">
                            {item.disabledLabel ?? "Soon"}
                          </span>
                        )}
                      </>
                    )}
                  </>
                );
                const itemClass = cn(
                  "relative flex w-full items-center gap-3 rounded-control text-body",
                  collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-active-bg font-medium text-sidebar-active-fg"
                    : item.disabled
                      ? "cursor-default text-sidebar-muted opacity-60"
                      : "text-sidebar-fg hover:bg-sidebar-hover"
                );
                const title = collapsed
                  ? item.disabled
                    ? `${item.label} — ${item.disabledLabel ?? "Soon"}`
                    : item.label
                  : undefined;

                return (
                  <li key={item.label}>
                    {item.href && !item.disabled ? (
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        title={title}
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
                        title={title}
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

      {footer && !collapsed && (
        <div className="border-t border-sidebar-border px-6 py-5">{footer}</div>
      )}
    </nav>
  );
}
