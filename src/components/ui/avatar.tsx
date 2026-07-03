import * as React from "react";
import { cn } from "@/lib/cn";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: "sm" | "md";
}

/** Initials chip — table rows, activity feeds, the top bar. */
export function Avatar({ name, size = "md", className, ...props }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-pill bg-accent-subtle font-medium text-fg-secondary",
        size === "sm" ? "size-8 text-caption" : "size-9 text-caption",
        className
      )}
      {...props}
    >
      {initials}
    </span>
  );
}
