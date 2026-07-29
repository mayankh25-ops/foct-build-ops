"use client";

/**
 * Timesheets — live (0010). The week a cleaner is actually paid for.
 *
 * Everything here reads one RPC, so this screen and the CSV export can never
 * disagree. The rules it depends on are enforced in the database, not here:
 * a correction needs a reason, a rejection needs a reason, and an approved
 * week is locked until someone reopens it.
 *
 * What a manager does: read the week, correct individual sessions where the
 * kiosk got it wrong, then approve, reject, or reopen — and export for payroll.
 */
import * as React from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  Loader2,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Timer,
  Undo2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  adjustSession,
  decideWeek,
  downloadCsv,
  fetchWeek,
  payableMinutes,
  shiftWeek,
  varianceMinutes,
  weekStart,
  weekToCsv,
  type LiveWeek,
  type LiveWeekRow,
  type WeekStatus,
} from "@/lib/timesheets-live";
import { cn } from "@/lib/cn";

const hm = (mins: number): string => {
  const sign = mins < 0 ? "−" : "";
  const a = Math.abs(Math.round(mins));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h === 0 ? "" : `${h}h `}${m === 0 && h > 0 ? "" : `${m}m`}`.trim() || "0m";
};

const signed = (mins: number): string => (mins > 0 ? `+${hm(mins)}` : mins < 0 ? hm(mins) : "—");

const statusTone: Record<WeekStatus, "neutral" | "success" | "critical"> = {
  pending: "neutral",
  approved: "success",
  rejected: "critical",
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";

/* ------------------------------------------------------------------ */
/* Review one person's week                                            */
/* ------------------------------------------------------------------ */

function ReviewModal({
  row,
  buildingId,
  week,
  onClose,
  onChanged,
}: {
  row: LiveWeekRow | null;
  buildingId: string;
  week: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [override, setOverride] = React.useState<string>("");
  const [drafts, setDrafts] = React.useState<Record<string, { delta: number; note: string }>>({});

  React.useEffect(() => {
    if (!row) return;
    setNote(row.note ?? "");
    setOverride("");
    setDrafts(
      Object.fromEntries(
        row.sessions.map((s) => [
          s.session_event_id,
          { delta: s.adjustment_minutes, note: s.adjustment_note },
        ])
      )
    );
  }, [row]);

  if (!row) return null;

  const locked = row.status === "approved";
  const payable = payableMinutes(row);

  const saveAdjustment = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setBusy(true);
    const res = await adjustSession(id, draft.delta, draft.note);
    setBusy(false);
    if (!res.ok) {
      toast({ tone: res.locked ? "warning" : "critical", title: "Not saved", description: res.error });
      return;
    }
    toast({ tone: "success", title: "Correction saved" });
    onChanged();
  };

  const decide = async (status: WeekStatus) => {
    if (status === "rejected" && note.trim().length === 0) {
      toast({
        tone: "warning",
        title: "Say why",
        description: "A rejection needs a reason the site can act on.",
      });
      return;
    }
    setBusy(true);
    const minutes =
      status === "approved" && override.trim() !== ""
        ? Math.round(parseFloat(override) * 60)
        : null;
    const res = await decideWeek({ buildingId, staffId: row.staff_id, week, status, minutes, note });
    setBusy(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not saved", description: res.error });
      return;
    }
    toast({
      tone: status === "approved" ? "success" : "neutral",
      title:
        status === "approved" ? "Approved" : status === "rejected" ? "Sent back" : "Reopened",
      description:
        status === "approved" && (res.open_sessions ?? 0) > 0
          ? `${res.open_sessions} shift(s) never signed out — paid as zero.`
          : undefined,
    });
    onChanged();
    onClose();
  };

  return (
    <Modal open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>
            {row.staff_name} · week of {dayLabel(week)}
          </ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-6 overflow-y-auto">
          {locked && (
            <p className="flex items-center gap-2.5 rounded-card bg-success-subtle px-4 py-3 text-body-sm text-success-text">
              <Lock aria-hidden className="size-4 shrink-0" />
              Approved{row.decided_by ? ` by ${row.decided_by}` : ""}
              {row.decided_at ? ` on ${new Date(row.decided_at).toLocaleDateString("en-AU")}` : ""}.
              Reopen the week to change any hours.
            </p>
          )}
          {row.status === "rejected" && (
            <p className="flex items-start gap-2.5 rounded-card bg-critical-subtle px-4 py-3 text-body-sm text-critical-text">
              <X aria-hidden className="mt-0.5 size-4 shrink-0" />
              Sent back{row.decided_by ? ` by ${row.decided_by}` : ""}: {row.note || "no reason given"}
            </p>
          )}
          {row.open_sessions > 0 && (
            <p className="flex items-start gap-2.5 rounded-card bg-warning-subtle px-4 py-3 text-body-sm text-warning-text">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {row.open_sessions} shift{row.open_sessions > 1 ? "s" : ""} never signed out. They pay
              nothing until corrected — add the hours to the session below, with a reason.
            </p>
          )}

          {/* the week at a glance */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Rostered", hm(row.rostered_minutes)],
              ["Worked", hm(row.worked_minutes)],
              ["Corrections", signed(row.adjustment_minutes)],
              ["Payable", hm(payable)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-card border border-edge bg-surface p-4">
                <p className="text-caption text-fg-muted">{label}</p>
                <p className="mt-1 font-numeric text-title-2 font-bold text-fg tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* every session, correctable */}
          <div className="space-y-3">
            <p className="text-body-sm font-medium text-fg">
              Sessions — the kiosk's record, and your corrections beside it
            </p>
            {row.sessions.length === 0 && (
              <p className="rounded-card border border-edge bg-canvas px-4 py-6 text-center text-body-sm text-fg-muted">
                No sign-ins this week.
              </p>
            )}
            {row.sessions.map((s) => {
              const draft = drafts[s.session_event_id] ?? { delta: 0, note: "" };
              const dirty =
                draft.delta !== s.adjustment_minutes || draft.note !== s.adjustment_note;
              return (
                <div
                  key={s.session_event_id}
                  className="rounded-card border border-edge bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-fg">{dayLabel(s.work_date)}</p>
                      <p className="mt-0.5 font-mono text-body-sm text-fg-secondary">
                        {clock(s.in_at)} → {s.out_at ? clock(s.out_at) : "still on site"}
                        {s.minutes !== null && ` · ${hm(s.minutes)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.recorded_offline && (
                        <Badge tone="neutral">
                          <CloudOff aria-hidden className="mr-1 size-3" />
                          offline
                        </Badge>
                      )}
                      {!s.out_at && <Badge tone="warning">no sign-out</Badge>}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <p className="mb-1.5 text-caption text-fg-muted">Correction</p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Subtract 15 minutes"
                          disabled={locked}
                          onClick={() =>
                            setDrafts((d) => ({
                              ...d,
                              [s.session_event_id]: { ...draft, delta: draft.delta - 15 },
                            }))
                          }
                          className="flex size-11 items-center justify-center rounded-control border border-edge-strong bg-surface text-fg transition-colors hover:bg-hover disabled:opacity-40"
                        >
                          <Minus aria-hidden className="size-4" />
                        </button>
                        <span className="w-24 text-center font-numeric text-title-3 font-semibold text-fg tabular-nums">
                          {signed(draft.delta)}
                        </span>
                        <button
                          type="button"
                          aria-label="Add 15 minutes"
                          disabled={locked}
                          onClick={() =>
                            setDrafts((d) => ({
                              ...d,
                              [s.session_event_id]: { ...draft, delta: draft.delta + 15 },
                            }))
                          }
                          className="flex size-11 items-center justify-center rounded-control border border-edge-strong bg-surface text-fg transition-colors hover:bg-hover disabled:opacity-40"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                    </div>
                    <Input
                      className="min-w-56 flex-1"
                      label="Reason"
                      placeholder="e.g. stayed to finish the lobby"
                      value={draft.note}
                      disabled={locked}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [s.session_event_id]: { ...draft, note: e.target.value },
                        }))
                      }
                    />
                    <Button
                      variant="secondary"
                      disabled={locked || busy || !dirty}
                      onClick={() => void saveAdjustment(s.session_event_id)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* the decision */}
          <div className="space-y-3 rounded-card border border-edge bg-canvas p-4">
            <Input
              label="Note for this week"
              placeholder={
                row.status === "rejected"
                  ? "Required when sending back"
                  : "Optional — visible to whoever reads this week later"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Input
              label="Pay a different number of hours (optional)"
              type="number"
              step="0.25"
              min="0"
              placeholder={(payable / 60).toFixed(2)}
              value={override}
              disabled={locked}
              onChange={(e) => setOverride(e.target.value)}
            />
            <p className="text-caption text-fg-muted">
              Leave blank to pay {hm(payable)} — the hours worked plus your corrections.
            </p>
          </div>
        </ModalBody>

        <ModalFooter className="flex-wrap gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {locked ? (
            <Button variant="secondary" disabled={busy} onClick={() => void decide("pending")}>
              <Undo2 aria-hidden className="size-4" />
              Reopen
            </Button>
          ) : (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => void decide("rejected")}>
                <X aria-hidden className="size-4" />
                Send back
              </Button>
              <Button disabled={busy} onClick={() => void decide("approved")}>
                {busy ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Check aria-hidden className="size-4" />
                )}
                Approve {hm(payable)}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function LiveTimesheets({
  buildingId,
  siteName,
}: {
  buildingId: string;
  siteName: string;
}) {
  const { toast } = useToast();
  const [week, setWeek] = React.useState(() => weekStart());
  const [data, setData] = React.useState<LiveWeek | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchWeek(buildingId, week)
      .then((w) => {
        setData(w);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildingId, week]);

  React.useEffect(load, [load]);

  const rows = data?.rows ?? [];
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      r.staff_name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const totals = rows.reduce(
    (acc, r) => ({
      rostered: acc.rostered + r.rostered_minutes,
      payable: acc.payable + payableMinutes(r),
      open: acc.open + r.open_sessions,
      pending: acc.pending + (r.status === "pending" ? 1 : 0),
    }),
    { rostered: 0, payable: 0, open: 0, pending: 0 }
  );

  const reviewRow = rows.find((r) => r.staff_id === reviewId) ?? null;

  const approveAllClean = async () => {
    // only the ones with nothing to argue about: no open shifts, some hours,
    // still pending. Everything else deserves a human look.
    const clean = rows.filter(
      (r) => r.status === "pending" && r.open_sessions === 0 && r.worked_minutes > 0
    );
    if (clean.length === 0) return;
    setBulkBusy(true);
    let done = 0;
    for (const r of clean) {
      const res = await decideWeek({
        buildingId,
        staffId: r.staff_id,
        week,
        status: "approved",
        note: "",
      });
      if (res.ok) done++;
    }
    setBulkBusy(false);
    toast({ tone: "success", title: `Approved ${done} of ${clean.length}` });
    load();
  };

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`timesheets-${siteName.replace(/\W+/g, "-").toLowerCase()}-${week}.csv`,
      weekToCsv(data, siteName));
    toast({
      tone: "success",
      title: "Exported",
      description: `${rows.length} people · one row per session`,
    });
  };

  const cleanCount = rows.filter(
    (r) => r.status === "pending" && r.open_sessions === 0 && r.worked_minutes > 0
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Cleaning · Payroll"
        title="Timesheets"
        description="Built from kiosk sign-ins — nothing hand-entered. Correct what's wrong, approve or send back, export for payroll."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!data || rows.length === 0}>
              <Download aria-hidden className="size-4" />
              Export CSV
            </Button>
            <Button onClick={() => void approveAllClean()} disabled={bulkBusy || cleanCount === 0}>
              {bulkBusy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {/* naming the number is the point: it says exactly how many
                  weeks have nothing to argue about before you press it */}
              {cleanCount === 0 ? "Nothing to bulk-approve" : `Approve ${cleanCount} clean`}
            </Button>
          </>
        }
      />

      {/* week picker */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setWeek((w) => shiftWeek(w, -1))}>
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </Button>
        <p className="font-medium text-fg">
          Week of {dayLabel(week)}
          <span className="ml-2 text-body-sm font-normal text-fg-muted">
            {data?.timezone ?? ""}
          </span>
        </p>
        <Button
          variant="secondary"
          onClick={() => setWeek((w) => shiftWeek(w, 1))}
          disabled={week >= weekStart()}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        {week !== weekStart() && (
          <Button variant="ghost" onClick={() => setWeek(weekStart())}>
            <RotateCcw aria-hidden className="size-4" />
            This week
          </Button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Rostered" value={hm(totals.rostered)} icon={Timer} />
        <MetricCard label="Payable" value={hm(totals.payable)} icon={Check} />
        <MetricCard
          label="Awaiting a decision"
          value={totals.pending}
          tone={totals.pending > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Never signed out"
          value={totals.open}
          context={totals.open > 0 ? "pays nothing until corrected" : undefined}
          tone={totals.open > 0 ? "critical" : "neutral"}
        />
      </div>

      {error && (
        <Card className="mb-6">
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      <FilterBar>
        <SearchInput
          label="Search people"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64"
        />
        <SegmentedControl
          label="Status"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: `All ${rows.length}` },
            { value: "pending", label: `Pending ${totals.pending}` },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Sent back" },
          ]}
        />
      </FilterBar>

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading the week…
          </CardBody>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Timer}
          title={rows.length === 0 ? "No sign-ins this week" : "Nothing matches this filter"}
          description={
            rows.length === 0
              ? "Once cleaners sign in on the kiosk, their hours appear here automatically."
              : "Try a different status or clear the search."
          }
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner</Th>
                <Th>Rostered</Th>
                <Th>Worked</Th>
                <Th>Corrections</Th>
                <Th>Payable</Th>
                <Th>Variance</Th>
                <Th>Status</Th>
                <Th className="text-right">Review</Th>
              </Tr>
            </THead>
            <TBody>
              {visible.map((r) => {
                const variance = varianceMinutes(r);
                return (
                  <Tr
                    key={r.staff_id}
                    className="cursor-pointer transition-colors hover:bg-hover"
                    onClick={() => setReviewId(r.staff_id)}
                  >
                    <Td className="font-medium text-fg">
                      {r.staff_name}
                      {r.open_sessions > 0 && (
                        <Badge tone="warning" className="ml-2">
                          {r.open_sessions} open
                        </Badge>
                      )}
                      {!r.active && (
                        <Badge tone="neutral" className="ml-2">
                          inactive
                        </Badge>
                      )}
                    </Td>
                    <Td className="font-numeric tabular-nums text-fg-secondary">
                      {hm(r.rostered_minutes)}
                    </Td>
                    <Td className="font-numeric tabular-nums text-fg">{hm(r.worked_minutes)}</Td>
                    <Td className="font-numeric tabular-nums text-fg-secondary">
                      {signed(r.adjustment_minutes)}
                    </Td>
                    <Td className="font-numeric font-semibold tabular-nums text-fg">
                      {hm(payableMinutes(r))}
                    </Td>
                    <Td
                      className={cn(
                        "font-numeric tabular-nums",
                        Math.abs(variance) > 30 ? "text-warning-text" : "text-fg-muted"
                      )}
                    >
                      {signed(variance)}
                    </Td>
                    <Td>
                      <Badge tone={statusTone[r.status]}>
                        {r.status === "rejected" ? "sent back" : r.status}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm">
                        Open
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <ReviewModal
        row={reviewRow}
        buildingId={buildingId}
        week={week}
        onClose={() => setReviewId(null)}
        onChanged={load}
      />
    </>
  );
}
