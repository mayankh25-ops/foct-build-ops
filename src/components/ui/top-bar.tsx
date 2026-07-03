"use client";

import * as React from "react";
import { Bell, Building2, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  buildingName: string;
  orgName?: string;
  userName: string;
  /** e.g. "Cleaning manager" */
  userRole?: string;
  onSearch?: (query: string) => void;
}

/** Horizontal app bar: building switcher, search, notifications, identity. */
export function TopBar({
  buildingName,
  orgName,
  userName,
  userRole,
  className,
  ...props
}: TopBarProps) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "flex h-16 items-center gap-4 border-b border-edge bg-surface px-6",
        className
      )}
      {...props}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-2.5 rounded-control border border-edge bg-surface py-2 pr-3 pl-2.5",
          "text-body-sm font-medium text-fg transition-colors hover:bg-hover"
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-sm bg-accent-subtle">
          <Building2 aria-hidden className="size-4 text-accent-text" />
        </span>
        {buildingName}
        {orgName && <span className="font-normal text-fg-muted">· {orgName}</span>}
        <ChevronDown aria-hidden className="size-4 text-fg-muted" />
      </button>

      <div className="relative ml-auto hidden w-72 md:block">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          type="search"
          placeholder="Search cleaners, shifts, orders…"
          aria-label="Search"
          className={cn(
            "h-10 w-full rounded-control border border-edge bg-canvas pr-3 pl-9 text-body-sm text-fg",
            "placeholder:text-fg-muted transition-colors focus:bg-surface"
          )}
        />
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex size-11 items-center justify-center rounded-pill border border-edge bg-surface text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
      >
        <Bell aria-hidden className="size-[18px]" />
        <span
          aria-hidden
          className="absolute top-2.5 right-3 size-2 rounded-pill bg-critical"
        />
        <span className="sr-only">1 unread alert</span>
      </button>

      <div className="flex items-center gap-3 border-l border-edge pl-4">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-pill bg-accent-subtle text-caption font-semibold text-accent-text"
        >
          {initials}
        </span>
        <div className="hidden leading-tight lg:block">
          <p className="text-body-sm font-medium text-fg">{userName}</p>
          {userRole && <p className="text-caption text-fg-muted">{userRole}</p>}
        </div>
      </div>
    </header>
  );
}
