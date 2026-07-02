import * as React from "react";
import { cn } from "@/lib/cn";

export interface TimelineRow {
  name: string;
  zone?: string;
  /** Decimal hours, e.g. 6 = 06:00, 9.5 = 09:30. */
  scheduled: [number, number];
  /** Actual span; end === null means still on site. */
  actual?: [number, number | null];
  status: "completed" | "on-site" | "late" | "missed";
}

export interface AttendanceTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  rows: TimelineRow[];
  /** Axis window in decimal hours. */
  windowStart?: number;
  windowEnd?: number;
  /** "Now" marker position in decimal hours (omit to hide). */
  now?: number;
}

const actualTone: Record<TimelineRow["status"], string> = {
  completed: "bg-success",
  "on-site": "bg-accent",
  late: "bg-warning",
  missed: "bg-critical",
};

function fmtHour(h: number) {
  return `${String(Math.floor(h)).padStart(2, "0")}:00`;
}

/** Live attendance: scheduled window vs actual presence per cleaner. */
export function AttendanceTimeline({
  rows,
  windowStart = 5,
  windowEnd = 13,
  now,
  className,
  ...props
}: AttendanceTimelineProps) {
  const span = windowEnd - windowStart;
  const pct = (h: number) => `${((h - windowStart) / span) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / span) * 100}%`;
  const hours = Array.from({ length: span + 1 }, (_, i) => windowStart + i);

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      {/* axis */}
      <div className="flex">
        <div className="w-40 shrink-0" />
        <div className="relative h-6 flex-1">
          {hours.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 font-mono text-caption text-fg-muted"
              style={{ left: pct(h) }}
            >
              {fmtHour(h)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center rounded-control py-2.5 transition-colors hover:bg-hover">
            <div className="w-40 shrink-0 pr-4">
              <p className="truncate text-body-sm font-medium text-fg">{row.name}</p>
              {row.zone && <p className="truncate text-caption text-fg-muted">{row.zone}</p>}
            </div>
            <div className="relative h-9 flex-1">
              {/* hour gridlines */}
              {hours.map((h) => (
                <span
                  key={h}
                  aria-hidden
                  className="absolute top-0 bottom-0 w-px bg-edge"
                  style={{ left: pct(h) }}
                />
              ))}
              {/* scheduled window */}
              <span
                aria-hidden
                className="absolute top-1/2 h-6 -translate-y-1/2 rounded-sm border border-edge bg-hover"
                style={{ left: pct(row.scheduled[0]), width: width(row.scheduled[0], row.scheduled[1]) }}
              />
              {/* actual presence */}
              {row.actual && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 h-3 -translate-y-1/2 rounded-pill",
                    actualTone[row.status]
                  )}
                  style={{
                    left: pct(row.actual[0]),
                    width: width(row.actual[0], row.actual[1] ?? now ?? windowEnd),
                  }}
                />
              )}
              {/* missed: marker at scheduled start */}
              {row.status === "missed" && !row.actual && (
                <span
                  aria-hidden
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-critical bg-surface"
                  style={{ left: pct(row.scheduled[0]) }}
                />
              )}
              <span className="sr-only">
                {row.name}: scheduled {fmtHour(row.scheduled[0])}–{fmtHour(row.scheduled[1])},{" "}
                {row.status === "missed"
                  ? "missed check-in"
                  : row.status === "on-site"
                    ? "on site now"
                    : row.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* now marker overlays the whole block */}
      {now !== undefined && (
        <div className="pointer-events-none relative flex">
          <div className="w-40 shrink-0" />
          <div className="relative flex-1">
            <span
              aria-hidden
              className="absolute -top-1 h-2 w-px"
              style={{ left: pct(now) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
