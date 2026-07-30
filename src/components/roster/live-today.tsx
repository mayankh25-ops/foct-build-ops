"use client";

/**
 * Today — live (0013). The question a supervisor asks twenty times a day:
 * right now, who is on site, who is late, and who never turned up.
 *
 * Nothing is decided here. The states, the counts and the grace period all come
 * from one read, so this screen and whatever raises an alert later cannot
 * disagree about the word "missed".
 */
import * as React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CloudOff, Clock, RotateCcw, UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import {
  dayNote,
  fetchDay,
  shiftDay,
  stateMeta,
  todayIso,
  type AttendanceDay,
  type DayRow,
} from "@/lib/attendance-live";
import { hm, minToTime } from "@/lib/roster-live";
import { cn } from "@/lib/cn";

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

function PersonRow({ row }: { row: DayRow }) {
  const meta = stateMeta[row.state];
  const note = dayNote(row, minToTime);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge px-5 py-4 last:border-b-0">
      <div className="min-w-48 flex-1">
        <p className="font-medium text-fg">
          {row.staff_name}
          {row.recorded_offline && (
            <Badge tone="neutral" className="ml-2">
              <CloudOff aria-hidden className="mr-1 size-3" />
              offline
            </Badge>
          )}
        </p>
        {note && (
          <p
            className={cn(
              "mt-0.5 text-body-sm",
              row.state === "missed" || row.overdue_minutes > 0
                ? "text-critical-text"
                : row.late_minutes > 0
                  ? "text-warning-text"
                  : "text-fg-muted"
            )}
          >
            {note}
          </p>
        )}
      </div>

      <div className="min-w-32 text-body-sm text-fg-secondary">
        {row.shifts.length === 0 ? (
          <span className="text-fg-muted">not rostered</span>
        ) : (
          row.shifts.map((s) => (
            <span key={s.id} className="mr-3 font-numeric tabular-nums">
              {minToTime(s.start_min)}–{minToTime(s.end_min)}
              {s.zone && <span className="ml-1 text-fg-muted">{s.zone}</span>}
            </span>
          ))
        )}
      </div>

      <div className="min-w-36 font-mono text-body-sm text-fg">
        {clock(row.first_in)} → {row.on_site ? "still here" : clock(row.last_out)}
      </div>

      <div className="min-w-16 text-right font-numeric font-semibold tabular-nums text-fg">
        {row.worked_minutes > 0 ? hm(row.worked_minutes) : "—"}
      </div>

      <Badge tone={meta.tone}>{meta.label}</Badge>
    </div>
  );
}

export function LiveToday({ buildingId, siteName }: { buildingId: string; siteName: string }) {
  const [date, setDate] = React.useState(() => todayIso());
  const [data, setData] = React.useState<AttendanceDay | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    fetchDay(buildingId, date)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildingId, date]);

  React.useEffect(load, [load]);

  // A supervisor leaves this open on a desk. Refreshing every minute is the
  // difference between a live board and a screenshot.
  React.useEffect(() => {
    if (date !== todayIso()) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load, date]);

  const s = data?.summary;
  const isToday = date === todayIso();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setDate((d) => shiftDay(d, -1))}>
          <ChevronLeft aria-hidden className="size-4" />
          Previous day
        </Button>
        <p className="font-medium text-fg">
          {dayLabel(date)}
          <span className="ml-2 text-body-sm font-normal text-fg-muted">{data?.timezone ?? ""}</span>
        </p>
        <Button variant="secondary" onClick={() => setDate((d) => shiftDay(d, 1))} disabled={isToday}>
          Next day
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        {!isToday && (
          <Button variant="ghost" onClick={() => setDate(todayIso())}>
            <RotateCcw aria-hidden className="size-4" />
            Today
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="On site now" value={s?.on_site ?? 0} icon={UserCheck} />
        <MetricCard
          label="No check-in"
          value={s?.missed ?? 0}
          context={
            s && s.missed > 0 ? `rostered, nothing after ${data?.grace_min ?? 15} minutes` : undefined
          }
          tone={s && s.missed > 0 ? "critical" : "neutral"}
        />
        <MetricCard
          label="Late"
          value={s?.late ?? 0}
          tone={s && s.late > 0 ? "warning" : "neutral"}
          icon={Clock}
        />
        <MetricCard label="Hours worked" value={hm(s?.worked_minutes ?? 0)} icon={Users} />
      </div>

      {error && (
        <Card className="mb-6">
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {/* The owner side and the concierge get progress, never staff records —
          decided by the database, and said plainly rather than shown as empty. */}
      {data && !data.detail ? (
        <Card>
          <CardBody className="flex items-start gap-3 text-body-sm text-fg-secondary">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span>
              You can see how the clean at {siteName} is tracking — {s?.on_site ?? 0} on site,{" "}
              {s?.finished ?? 0} finished of {s?.rostered ?? 0} rostered. Individual staff records
              belong to the company that employs them.
            </span>
          </CardBody>
        </Card>
      ) : loading ? (
        <Card>
          <CardBody className="text-body-sm text-fg-muted">Loading today…</CardBody>
        </Card>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody rostered, nobody here"
          description="Add shifts on the week board, and sign-ins from the kiosk will appear here as they happen."
        />
      ) : (
        <Card>
          <div className="border-b border-edge px-5 py-3">
            <p className="text-caption text-fg-muted">
              Problems first, then who is on site. Refreshes every minute.
            </p>
          </div>
          {data?.rows.map((r) => (
            <PersonRow key={r.staff_id} row={r} />
          ))}
        </Card>
      )}
    </>
  );
}
