"use client";

import * as React from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
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
        "flex h-14 items-center gap-4 border-b border-edge bg-surface px-4",
        className
      )}
      {...props}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-control px-2.5 py-1.5 text-body-sm font-medium text-fg",
          "transition-colors hover:bg-hover"
        )}
      >
        {buildingName}
        {orgName && <span className="font-normal text-fg-muted">· {orgName}</span>}
        <ChevronDown aria-hidden className="size-4 text-fg-muted" />
      </button>

      <div className="relative ml-auto hidden w-64 md:block">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted"
        />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search"
          className={cn(
            "h-8 w-full rounded-control border border-edge bg-canvas pr-3 pl-8 text-body-sm text-fg",
            "placeholder:text-fg-muted"
          )}
        />
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className="rounded-control p-2 text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
      >
        <Bell aria-hidden className="size-4" />
      </button>

      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-pill bg-accent-subtle text-caption font-semibold text-accent-text"
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
