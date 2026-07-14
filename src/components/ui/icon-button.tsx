"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only buttons must still be named for screen readers. */
  label: string;
  variant?: "ghost" | "outline";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = "ghost", className, children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-control transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-[18px]",
        variant === "outline"
          ? "border border-edge bg-surface text-fg-secondary hover:bg-hover hover:text-fg"
          : "text-fg-secondary hover:bg-hover hover:text-fg",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";
