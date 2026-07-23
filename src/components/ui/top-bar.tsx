"use client";

import * as React from "react";
import { Bell, Building2, ChevronsUpDown, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  orgName: string;
  buildingName: string;
  userName: string;
  /** e.g. "Cleaning manager" */
  userRole?: string;
  onSignOut?: () => void;
}

/** App bar: organisation / building switchers, build chip, alerts, identity. */
export function TopBar({ orgName, buildingName, userName, userRole, onSignOut, className, ...props }: TopBarProps) {
  return (
    <header
      className={cn(
        "flex h-16 items-center gap-3 border-b border-edge bg-surface px-6",
        className
      )}
      {...props}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-control border border-edge bg-surface px-3 py-2",
          "text-body-sm font-medium text-fg transition-colors hover:bg-hover"
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-sm bg-accent text-caption font-semibold text-on-accent">
          {orgName[0]}
        </span>
        <span className="max-w-44 truncate">{orgName}</span>
        <ChevronsUpDown aria-hidden className="size-3.5 text-fg-muted" />
      </button>
      <span aria-hidden className="text-fg-disabled">
        /
      </span>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 rounded-control border border-edge bg-surface px-3 py-2",
          "text-body-sm font-medium text-fg transition-colors hover:bg-hover"
        )}
      >
        <Building2 aria-hidden className="size-4 text-fg-muted" />
        <span className="max-w-48 truncate">{buildingName}</span>
        <ChevronsUpDown aria-hidden className="size-3.5 text-fg-muted" />
      </button>

      <span className="ml-auto hidden items-center gap-1.5 rounded-pill border border-edge bg-canvas px-3 py-1.5 text-caption font-medium text-fg-secondary sm:flex">
        <Sparkles aria-hidden className="size-3.5 text-accent-text" />
        Preview build
      </span>

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex size-10 items-center justify-center rounded-pill border border-edge bg-surface text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
      >
        <Bell aria-hidden className="size-[18px]" />
        <span aria-hidden className="absolute top-2 right-2.5 size-2 rounded-pill bg-critical" />
        <span className="sr-only">1 unread alert</span>
      </button>

      <div className="flex items-center gap-2.5 border-l border-edge pl-3">
        <Avatar name={userName} size="sm" />
        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            className="ml-1 rounded-control px-2.5 py-1.5 text-body-sm font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            Sign out
          </button>
        )}
        <div className="hidden leading-tight lg:block">
          <p className="text-body-sm font-medium text-fg">{userName}</p>
          {userRole && <p className="text-caption text-fg-muted">{userRole}</p>}
        </div>
      </div>
    </header>
  );
}
