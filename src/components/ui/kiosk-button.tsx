"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface KioskButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}

/**
 * The kiosk's primary control: 88px tall, well past the 64px minimum the
 * tablet works to (itself double the 44px web rule). Wet hands, gloves, no
 * reading glasses, read from 1.5 m away.
 */
export const KioskButton = React.forwardRef<HTMLButtonElement, KioskButtonProps>(
  ({ icon: Icon, variant = "primary", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex min-h-[5.5rem] w-full items-center justify-center gap-4 rounded-card px-8",
        "font-display text-title-1 font-medium transition-all duration-150",
        "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40",
        variant === "primary"
          ? "bg-accent text-on-accent shadow-raised hover:bg-accent-hover"
          : "border border-edge bg-surface text-fg shadow-card hover:bg-hover",
        className
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden className="size-8 shrink-0" />}
      {children}
    </button>
  )
);
KioskButton.displayName = "KioskButton";
