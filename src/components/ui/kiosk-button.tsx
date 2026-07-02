"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface KioskButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}

/**
 * Very large touch target for the kiosk (min 88px tall). Feels like an
 * iPad control, not an admin button.
 */
export const KioskButton = React.forwardRef<HTMLButtonElement, KioskButtonProps>(
  ({ icon: Icon, variant = "primary", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex min-h-[5.5rem] w-full items-center justify-center gap-4 rounded-card px-8",
        "font-display text-title-1 font-semibold transition-all duration-150",
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
