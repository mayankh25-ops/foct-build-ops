"use client";

import * as React from "react";
import { CheckCheck, ClipboardCheck, Download, PencilLine } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  dateKey,
  deriveShift,
  deriveTimesheets,
  useAttendanceReady,
  useAttendanceStore,
  type TimesheetWeekRow,
} from "@/lib/attendance-store";
import { fmtTime, shiftStatusMeta } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

/**
 * Timesheets — AUTOMATIC. Every number on this page derives from kiosk
 * check-in/out events vs the roster: no hand-entered hours. Approving a
 * week stamps the store; export writes the same derived rows to CSV.
 */

function fmtClock(d?: Date): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function reviewNote(r: TimesheetWeekRow): string | null {
  const missed = r.entries.filter((e) => e.status === "missed");
  if (missed.length)
    return `Missed ${missed.length === 1 ? "a rostered shift" : `${missed.length} rostered shifts`} (${missed
      .map((e) => e.shift.date.slice(5))
      .join(", ")}) — confirm cover before approving.`;
  if (Math.abs(r.variance) > 0.5)
    return `${r.variance > 0 ? "+" : ""}${r.variance.toFixed(2)} h against roster this week — check the shift detail before approving.`;
  return null;
}

/* ---------------------------------------------------------------- */
/* Review & approve — the manager's payroll decision, not a rubber   */
/* stamp: adjust the hours, leave a remark, then approve.            */
/* ---------------------------------------------------------------- */

function ReviewApproveModal({
  row,
  now,
  onSetCorrection,
  onClose,
  onApprove,
}: {
  row: TimesheetWeekRow | null;
  now: Date;
  onSetCorrection: (shiftId: string, c: { delta: number; note: string } | null) => void;
  onClose: () => void;
  onApprove: (opts: { note?: string; approvedHours?: number }) => void;
}) {
  const [hours, setHours] = React.useState("");
  const [note, setNote] = React.useState("");
  const [hoursTouched, setHoursTouched] = React.useState(false);

  React.useEffect(() => {
    if (row) {
      setHours(row.corrected.toFixed(2));
      setNote("");
      setHoursTouched(false);
    }
  }, [row?.staff.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // per-shift corrections change the payable total — follow it until the
  // manager types their own figure
  React.useEffect(() => {
    if (row && !hoursTouched) setHours(row.corrected.toFixed(2));
  }, [row, hoursTouched]);

  if (!row) return null;

  const parsed = Number.parseFloat(hours);
  const validHours = Number.isFinite(parsed) && parsed >= 0 && parsed <= 24 * 7;
  const adjusted = validHours && Math.abs(parsed - row.actual) > 0.01;
  const correctedCount = row.entries.filter((e) => e.correction).length;
  const reviewReason = reviewNote(row);

  return (
    <Modal open onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Review {row.staff.name.split(" ")[0]}&apos;s week</ModalTitle>
          <ModalDescription>
            Week of{" "}
            {new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000).toLocaleDateString(
              "en-AU",
              { day: "numeric", month: "long" }
            )}{" "}
            · every number below derives from kiosk check-ins vs the roster.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          {reviewReason && (
            <div className="rounded-card border border-edge bg-warning-subtle px-4 py-3 text-body-sm text-warning-text">
              {reviewReason}
            </div>
          )}

          <Table>
            <THead>
              <Tr>
                <Th>Day</Th>
                <Th numeric>Rostered</Th>
                <Th numeric>Kiosk in–out</Th>
                <Th numeric>Actual</Th>
                <Th className="w-24">± Hours</Th>
                <Th>Correction remark</Th>
              </Tr>
            </THead>
            <TBody>
              {row.entries.map((e) => {
                const meta = shiftStatusMeta[e.status];
                const day = new Date(`${e.shift.date}T12:00:00`);
                return (
                  <Tr key={e.shift.id}>
                    <Td className="font-medium">
                      <span className="flex flex-col">
                        {day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}
                        <StatusPill tone={meta.tone} className="mt-1 w-fit">{meta.label}</StatusPill>
                      </span>
                    </Td>
                    <Td numeric>
                      {fmtTime(e.shift.start)}–{fmtTime(e.shift.end)}
                    </Td>
                    <Td numeric>
                      {fmtClock(e.checkIn)} – {e.inProgress ? "on site" : fmtClock(e.checkOut)}
                    </Td>
                    <Td numeric>
                      {e.actual.toFixed(2)} h
                      {e.correction && (
                        <span className="block text-caption text-warning-text">
                          → pays {e.paid.toFixed(2)} h
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Input
                        aria-label={`Correction hours for ${day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}`}
                        inputMode="decimal"
                        placeholder="+/−"
                        className="h-9 w-20 px-2 text-body-sm"
                        defaultValue={e.correction ? String(e.correction.delta) : ""}
                        onBlur={(ev) => {
                          const delta = Number.parseFloat(ev.target.value);
                          if (!Number.isFinite(delta) || Math.abs(delta) < 0.001) {
                            onSetCorrection(e.shift.id, null);
                          } else {
                            onSetCorrection(e.shift.id, {
                              delta: Math.round(delta * 100) / 100,
                              note: e.correction?.note ?? "",
                            });
                          }
                        }}
                      />
                    </Td>
                    <Td>
                      <Input
                        aria-label={`Correction remark for ${day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}`}
                        placeholder="Why — e.g. forgot to clock out"
                        className="h-9 px-2 text-body-sm"
                        defaultValue={e.correction?.note ?? ""}
                        onBlur={(ev) => {
                          if (e.correction) {
                            onSetCorrection(e.shift.id, { delta: e.correction.delta, note: ev.target.value.trim() });
                          }
                        }}
                        disabled={!e.correction}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          {correctedCount > 0 && (
            <p className="-mt-2 text-caption text-fg-muted">
              {correctedCount} shift{correctedCount === 1 ? "" : "s"} corrected — payable total{" "}
              <span className="font-numeric">{row.corrected.toFixed(2)} h</span> (raw{" "}
              <span className="font-numeric">{row.actual.toFixed(2)} h</span>).
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ts-hours" className="text-body-sm font-medium text-fg">
                Hours to payroll
              </label>
              <Input
                id="ts-hours"
                inputMode="decimal"
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  setHoursTouched(true);
                }}
                error={validHours ? undefined : "Enter hours, e.g. 36.5"}
              />
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHours(row.corrected.toFixed(2));
                    setHoursTouched(false);
                  }}
                  className="text-caption font-medium text-accent-text hover:opacity-80"
                >
                  Use corrected ({row.corrected.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHours(row.rostered.toFixed(2));
                    setHoursTouched(true);
                  }}
                  className="text-caption font-medium text-accent-text hover:opacity-80"
                >
                  Use rostered ({row.rostered.toFixed(2)})
                </button>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ts-note" className="text-body-sm font-medium text-fg">
                Remarks (payroll note, optional)
              </label>
              <textarea
                id="ts-note"
                rows={3}
                placeholder="e.g. Reduced 0.5 h — long break Wednesday; variation approved for L14 spill."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-card border border-edge-strong bg-surface px-3.5 py-2.5 text-body text-fg placeholder:text-fg-disabled"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!validHours}
            onClick={() =>
              onApprove({
                note: note.trim() || undefined,
                approvedHours: adjusted ? Math.round(parsed * 100) / 100 : undefined,
              })
            }
          >
            {adjusted ? `Approve at ${parsed.toFixed(2)} h` : "Approve week"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function TimesheetsPage() {
  const now = useAttendanceReady();
  const shifts = useAttendanceStore((s) => s.shifts);
  const events = useAttendanceStore((s) => s.events);
  const approvals = useAttendanceStore((s) => s.approvals);
  const approvalMeta = useAttendanceStore((s) => s.approvalMeta);
  const corrections = useAttendanceStore((s) => s.corrections);
  const setCorrection = useAttendanceStore((s) => s.setCorrection);
  const approveWeek = useAttendanceStore((s) => s.approveWeek);
  const approveAllReady = useAttendanceStore((s) => s.approveAllReady);

  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const { toast } = useToast();

  if (!now) return null; // one paint: store seeds + clock arrives post-mount

  const rows = deriveTimesheets(shifts, events, approvals, now, approvalMeta, corrections);
  const todayViews = shifts
    .filter((s) => s.date === dateKey(now))
    .map((s) => deriveShift(s, events, now))
    .sort((a, b) => a.shift.start - b.shift.start);

  const visible = rows.filter((r) => {
    const byFilter =
      filter === "all" ||
      (filter === "review" && r.needsReview && !r.approved) ||
      (filter === "approved" && r.approved);
    return byFilter && r.staff.name.toLowerCase().includes(query.toLowerCase());
  });

  const rosteredTotal = rows.reduce((n, r) => n + r.rostered, 0);
  const actualTotal = rows.reduce((n, r) => n + r.actual, 0);
  const flagged = rows.filter((r) => r.needsReview && !r.approved).length;
  const missedToday = todayViews.filter((v) => v.status === "missed").length;
  const ready = rows.filter((r) => !r.needsReview && !r.approved).length;
  const notes = rows
    .filter((r) => r.needsReview && !r.approved)
    .map((r) => ({ name: r.staff.name, note: reviewNote(r) }))
    .filter((n): n is { name: string; note: string } => !!n.note);

  const exportCsv = () => {
    const lines = [
      "cleaner,week_rostered_h,week_actual_h,variance_h,approved_h,status,remarks",
      ...rows.map((r) =>
        [
          r.staff.name,
          r.rostered.toFixed(2),
          r.actual.toFixed(2),
          r.variance.toFixed(2),
          r.approved ? (r.approval?.approvedHours ?? r.actual).toFixed(2) : "",
          r.approved ? "approved" : r.needsReview ? "needs-review" : "ready",
          JSON.stringify(r.approval?.note ?? ""),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timesheets-week-${dateKey(now)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ tone: "success", title: "CSV exported", description: `${rows.length} cleaner weeks` });
  };

  return (
    <>
      <PageHeader
        eyebrow="Cleaning · Payroll"
        title="Timesheets & variance"
        description="Built automatically from kiosk check-ins vs the roster — nothing hand-entered. Review the flags, approve, export for payroll."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv}>
              <Download aria-hidden /> Export CSV
            </Button>
            <Button
              disabled={ready === 0}
              onClick={() => {
                approveAllReady(now);
                toast({
                  tone: "success",
                  title: "Week approved",
                  description: `${ready} timesheet${ready === 1 ? "" : "s"} approved · ${flagged} left for review`,
                });
              }}
            >
              <CheckCheck aria-hidden /> Approve all ready
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Rostered this week" value={rosteredTotal.toFixed(1)} context={`${rows.length} cleaners`} />
        <MetricCard
          label="Actual from kiosk"
          value={actualTotal.toFixed(1)}
          context={`${events.length} check events`}
          tone="success"
        />
        <MetricCard
          label="Needs review"
          value={flagged}
          context="variance > 0.5 h or missed shift"
          tone={flagged ? "warning" : "neutral"}
        />
        <MetricCard
          label="Missed today"
          value={missedToday}
          context={missedToday ? "15-min grace expired" : "all shifts covered"}
          tone={missedToday ? "critical" : "neutral"}
        />
      </div>

      <div className="mt-8">
        <FilterBar>
          <SearchInput
            className="w-72"
            placeholder="Search cleaner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SegmentedControl
            label="Timesheet filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "review", label: "Needs review" },
              { value: "approved", label: "Approved" },
            ]}
          />
        </FilterBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review here"
            description="No cleaner weeks match that filter — clear it to see everyone."
            action={
              <Button variant="secondary" size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner</Th>
                <Th numeric>Shifts</Th>
                <Th numeric>Rostered</Th>
                <Th className="w-52">Actual</Th>
                <Th>Variance</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {visible.map((r) => {
                const pct = r.rostered ? Math.min(100, (r.actual / r.rostered) * 100) : 0;
                return (
                  <Tr key={r.staff.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={r.staff.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.staff.name}</span>
                          <span className="block truncate text-caption text-fg-muted">
                            {r.entries.length} rostered · week of{" "}
                            {r.entries[0]?.shift.date.slice(5) ?? "—"}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td numeric>{r.entries.length}</Td>
                    <Td numeric>{r.rostered.toFixed(1)}h</Td>
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 w-24 overflow-hidden rounded-pill bg-hover">
                          <span
                            className={cn(
                              "block h-full rounded-pill",
                              r.needsReview && !r.approved ? "bg-warning" : "bg-success"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="font-numeric text-caption text-fg-secondary tabular-nums">
                          {r.actual.toFixed(1)}/{r.rostered.toFixed(1)}h
                        </span>
                      </span>
                    </Td>
                    <Td>
                      {Math.abs(r.variance) < 0.05 ? (
                        <Badge tone="success">On roster</Badge>
                      ) : (
                        <Badge tone={Math.abs(r.variance) > 0.5 ? "warning" : "neutral"}>
                          <span className="font-mono">
                            {r.variance > 0 ? `+${r.variance.toFixed(2)}` : r.variance.toFixed(2)} h
                          </span>
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {r.approved ? (
                        <span className="flex flex-col items-start gap-1">
                          <StatusPill tone="success">
                            {r.approval?.approvedHours !== undefined &&
                            Math.abs(r.approval.approvedHours - r.actual) > 0.01
                              ? "Approved · adjusted"
                              : "Approved"}
                          </StatusPill>
                          {r.approval?.note && (
                            <span className="max-w-52 truncate text-caption text-fg-muted" title={r.approval.note}>
                              “{r.approval.note}”
                            </span>
                          )}
                        </span>
                      ) : r.needsReview ? (
                        <StatusPill tone="warning">Needs review</StatusPill>
                      ) : (
                        <StatusPill tone="accent">Ready</StatusPill>
                      )}
                    </Td>
                    <Td className="text-right">
                      {r.approved ? (
                        <span className="font-numeric text-body-sm text-fg-secondary tabular-nums">
                          {(r.approval?.approvedHours ?? r.actual).toFixed(1)} h to payroll
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setReviewId(r.staff.id)}>
                          <PencilLine aria-hidden /> Review &amp; approve
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Today’s shifts — live from the kiosk</CardTitle>
          <Badge tone="neutral">{todayViews.length} rostered</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner / zone</Th>
                <Th>Rostered</Th>
                <Th numeric>Check in</Th>
                <Th numeric>Check out</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {todayViews.map((v) => {
                const meta = shiftStatusMeta[v.status];
                return (
                  <Tr key={v.shift.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={v.staff.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{v.staff.name}</span>
                          <span className="block truncate text-caption text-fg-muted">{v.shift.zone}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {fmtTime(v.shift.start)} → {fmtTime(v.shift.end)}
                      </span>
                    </Td>
                    <Td numeric>{fmtClock(v.checkIn)}</Td>
                    <Td numeric>{fmtClock(v.checkOut)}</Td>
                    <Td>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </CardBody>
      </Card>

      <ReviewApproveModal
        row={rows.find((r) => r.staff.id === reviewId) ?? null}
        now={now}
        onSetCorrection={setCorrection}
        onClose={() => setReviewId(null)}
        onApprove={(opts) => {
          const row = rows.find((r) => r.staff.id === reviewId);
          if (!row) return;
          approveWeek(row.staff.id, now, opts);
          setReviewId(null);
          toast({
            tone: "success",
            title: `${row.staff.name.split(" ")[0]}'s week approved`,
            description: `${(opts.approvedHours ?? row.actual).toFixed(1)} h to payroll${opts.note ? " · remark saved" : ""}`,
          });
        }}
      />

      {notes.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Review notes</CardTitle>
            <Badge tone="warning">{notes.length}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            {notes.map((t, i) => (
              <div key={t.name} className={cn("flex items-start gap-3", i > 0 && "border-t border-edge pt-5")}>
                <Avatar name={t.name} size="sm" />
                <div>
                  <p className="text-body-sm font-medium text-fg">{t.name}</p>
                  <p className="mt-0.5 text-body-sm text-fg-secondary">{t.note}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
