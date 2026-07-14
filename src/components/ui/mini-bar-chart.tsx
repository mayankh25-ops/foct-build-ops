import * as React from "react";
import { cn } from "@/lib/cn";

export interface BarDatum {
  label: string;
  /** Primary series (accent bars). */
  value: number;
  /** Optional comparison series rendered as a muted bar behind (e.g. rostered vs actual). */
  reference?: number;
  /** Highlight this bar (e.g. today). */
  emphasis?: boolean;
}

export interface MiniBarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarDatum[];
  /** Max Y; defaults to the largest value/reference. */
  max?: number;
  /** Format a value for the sr-only/table summary, e.g. (v) => `${v} h`. */
  format?: (v: number) => string;
  seriesLabel?: string;
  referenceLabel?: string;
}

/**
 * Dependency-free bar chart for small operational summaries (weekly hours,
 * orders per month). Tokens only; values are exposed to screen readers as text.
 */
export function MiniBarChart({
  data,
  max,
  format = (v) => String(v),
  seriesLabel = "Actual",
  referenceLabel = "Rostered",
  className,
  ...props
}: MiniBarChartProps) {
  const top = max ?? Math.max(...data.map((d) => Math.max(d.value, d.reference ?? 0))) * 1.15;
  const hasReference = data.some((d) => d.reference !== undefined);

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      <div className="flex h-44 items-end gap-3 sm:gap-4" aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <div className="relative flex h-full items-end justify-center">
              {hasReference && d.reference !== undefined && (
                <div
                  className="absolute bottom-0 w-full max-w-9 rounded-t-sm bg-hover"
                  style={{ height: `${(d.reference / top) * 100}%` }}
                />
              )}
              <div
                className={cn(
                  "relative w-full max-w-9 rounded-t-sm transition-colors",
                  d.emphasis ? "bg-accent" : "bg-accent/55 group-hover:bg-accent"
                )}
                style={{ height: `${(d.value / top) * 100}%` }}
              />
            </div>
            <p
              className={cn(
                "truncate text-center text-caption",
                d.emphasis ? "font-medium text-fg" : "text-fg-muted"
              )}
            >
              {d.label}
            </p>
          </div>
        ))}
      </div>
      {hasReference && (
        <div className="flex items-center gap-5 text-caption text-fg-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent" /> {seriesLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-hover" /> {referenceLabel}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>{seriesLabel} by period</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{seriesLabel}</th>
            {hasReference && <th>{referenceLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{format(d.value)}</td>
              {hasReference && <td>{d.reference !== undefined ? format(d.reference) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
