"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface LiveClockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "hero" = kiosk-size 24h clock; "display" = dashboard card clock with seconds. */
  variant?: "display" | "hero";
  showDate?: boolean;
}

/** Ticking local-time clock; renders placeholders until mounted (no hydration drift). */
export function LiveClock({ variant = "display", showDate = true, className, ...props }: LiveClockProps) {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hm = now
    ? now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: variant === "display" })
    : "--:--";
  const secs = now ? String(now.getSeconds()).padStart(2, "0") : "--";
  const date = now
    ? now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })
    : " ";

  return (
    <div className={cn(className)} {...props}>
      <p
        className={cn(
          "text-fg tabular-nums",
          variant === "hero" ? "font-numeric text-hero" : "font-mono text-display"
        )}
      >
        {variant === "display" ? (
          <>
            {hm.replace(/\s?(am|pm)$/i, "")}
            <span className="ml-2 align-baseline text-title-3 text-fg-muted">{secs}</span>
            <span className="ml-2 align-baseline text-title-3 font-medium text-fg-secondary uppercase">
              {now ? (now.getHours() < 12 ? "am" : "pm") : ""}
            </span>
          </>
        ) : (
          hm
        )}
      </p>
      {showDate && <p className="mt-1.5 text-body-sm text-fg-muted">{date}</p>}
    </div>
  );
}
