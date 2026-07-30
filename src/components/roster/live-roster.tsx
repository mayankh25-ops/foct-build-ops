"use client";

/**
 * Roster — live (0011). Who is meant to be here, and when.
 *
 * A week board: people down the side, the seven days across. Click an empty
 * cell to roster somebody, click a shift to move or remove it, copy last week
 * when nothing has changed.
 *
 * The rules that keep it honest live in the database — a finish after its
 * start, no double-booking the same person, only your own staff. This screen
 * checks the obvious clash before the round trip purely so the answer is
 * instant; the server is still the authority and its refusal wins.
 */
import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  clashesWith,
  copyWeek,
  deleteShift,
  fetchRosterWeek,
  hm,
  minToTime,
  saveShift,
  timeToMin,
  weekDays,
  type RosterShift,
  type RosterWeek,
} from "@/lib/roster-live";
import { LiveToday } from "@/components/roster/live-today";
import { shiftWeek, weekStart } from "@/lib/timesheets-live";
import { cn } from "@/lib/cn";

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const dayName = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short" });

const dayNumber = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

/** What the editor is working on: a brand-new shift, or an existing one. */
interface Draft {
  id: string | null;
  staffId: string;
  date: string;
  start: string;
  end: string;
  zone: string;
  note: string;
}

const newDraft = (staffId: string, date: string): Draft => ({
  id: null,
  staffId,
  date,
  start: "06:00",
  end: "14:00",
  zone: "",
  note: "",
});

const draftOf = (s: RosterShift): Draft => ({
  id: s.id,
  staffId: s.staff_id,
  date: s.work_date,
  start: minToTime(s.start_min),
  end: minToTime(s.end_min),
  zone: s.zone,
  note: s.note,
});

/* ------------------------------------------------------------------ */
/* The editor                                                          */
/* ------------------------------------------------------------------ */

function ShiftModal({
  draft,
  week,
  buildingId,
  data,
  onClose,
  onSaved,
}: {
  draft: Draft | null;
  week: string;
  buildingId: string;
  data: RosterWeek | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<Draft | null>(draft);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(draft);
    setError(null);
  }, [draft]);

  if (!form || !data) return null;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const startMin = timeToMin(form.start);
  const endMin = timeToMin(form.end);
  const minutes = startMin !== null && endMin !== null ? endMin - startMin : null;

  // Courtesy only — the trigger in the database is what actually decides.
  const clash =
    startMin !== null && endMin !== null && endMin > startMin
      ? clashesWith(data.shifts, {
          staffId: form.staffId,
          date: form.date,
          startMin,
          endMin,
          ignoreId: form.id ?? undefined,
        })
      : undefined;

  const submit = async () => {
    if (startMin === null || endMin === null) {
      setError("Use 24-hour times, like 06:00.");
      return;
    }
    if (endMin <= startMin) {
      setError("The finish time must be after the start time.");
      return;
    }
    setBusy(true);
    const res = await saveShift({
      buildingId,
      staffId: form.staffId,
      date: form.date,
      startMin,
      endMin,
      zone: form.zone,
      note: form.note,
      id: form.id,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save that shift.");
      return;
    }
    toast({
      tone: "success",
      title: form.id ? "Shift updated" : "Shift added",
      description: `${dayLabel(form.date)} · ${form.start}–${form.end}`,
    });
    onSaved();
    onClose();
  };

  const remove = async () => {
    if (!form.id) return;
    setBusy(true);
    const res = await deleteShift(form.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not remove that shift.");
      return;
    }
    toast({ tone: "neutral", title: "Shift removed" });
    onSaved();
    onClose();
  };

  return (
    <Modal open onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{form.id ? "Edit shift" : "Add a shift"}</ModalTitle>
        </ModalHeader>

        <ModalBody className="space-y-5">
          <Select
            label="Who"
            value={form.staffId}
            onValueChange={(v) => set("staffId", v)}
            options={data.staff.map((s) => ({
              value: s.id,
              label: s.role ? `${s.name} · ${s.role}` : s.name,
            }))}
          />
          <Select
            label="Day"
            value={form.date}
            onValueChange={(v) => set("date", v)}
            options={weekDays(week).map((d) => ({ value: d, label: dayLabel(d) }))}
          />
          <div className="flex flex-wrap gap-4">
            <Input
              className="min-w-32"
              label="Start"
              type="time"
              step={300}
              value={form.start}
              onChange={(e) => set("start", e.target.value)}
            />
            <Input
              className="min-w-32"
              label="Finish"
              type="time"
              step={300}
              value={form.end}
              onChange={(e) => set("end", e.target.value)}
            />
            <div className="flex flex-col justify-end pb-2.5">
              <p className="font-numeric text-title-3 font-semibold text-fg tabular-nums">
                {minutes !== null && minutes > 0 ? hm(minutes) : "—"}
              </p>
            </div>
          </div>
          <Input
            label="Area (optional)"
            placeholder="e.g. Lobby, L9–L24, Car park"
            value={form.zone}
            onChange={(e) => set("zone", e.target.value)}
          />
          <Input
            label="Note (optional)"
            placeholder="e.g. marble polish, bring the scrubber"
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />

          {clash && (
            <p className="rounded-card bg-warning-subtle px-4 py-3 text-body-sm text-warning-text">
              Already rostered {minToTime(clash.start_min)}–{minToTime(clash.end_min)}
              {clash.zone ? ` (${clash.zone})` : ""} that day. Two shifts at once will be refused.
            </p>
          )}
          {error && (
            <p className="rounded-card bg-critical-subtle px-4 py-3 text-body-sm text-critical-text">
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex-wrap gap-2">
          {form.id && (
            <Button variant="ghost" disabled={busy} onClick={() => void remove()}>
              <Trash2 aria-hidden className="size-4" />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {form.id ? "Save shift" : "Add shift"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function LiveRoster({ buildingId, siteName }: { buildingId: string; siteName: string }) {
  const { toast } = useToast();
  const [view, setView] = React.useState("today");
  const [week, setWeek] = React.useState(() => weekStart());
  const [data, setData] = React.useState<RosterWeek | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [copying, setCopying] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchRosterWeek(buildingId, week)
      .then((w) => {
        setData(w);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildingId, week]);

  React.useEffect(load, [load]);

  const days = React.useMemo(() => weekDays(week), [week]);
  const staff = data?.staff ?? [];
  const shifts = data?.shifts ?? [];
  const today = todayIso();

  const totals = {
    minutes: shifts.reduce((n, s) => n + s.minutes, 0),
    shifts: shifts.length,
    people: new Set(shifts.map((s) => s.staff_id)).size,
    unrostered: staff.filter((s) => s.rostered_minutes === 0).length,
  };

  const copyLastWeek = async () => {
    setCopying(true);
    const res = await copyWeek(buildingId, shiftWeek(week, -1), week);
    setCopying(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Nothing copied", description: res.error });
      return;
    }
    toast({
      tone: res.copied === 0 ? "warning" : "success",
      title: res.copied === 0 ? "Last week was empty" : `Copied ${res.copied} shifts`,
      // saying what was skipped matters: a silent drop reads as a full copy
      description:
        (res.skipped ?? 0) > 0
          ? `${res.skipped} skipped — those people were already rostered over that time.`
          : undefined,
    });
    load();
  };

  return (
    <>
      <PageHeader
        eyebrow="Cleaning · Roster"
        title="Roster"
        description={`Who is meant to be at ${siteName}, and when. The kiosk and timesheets read these same shifts.`}
        actions={
          view === "today" ? undefined : (
          <>
            <Button variant="secondary" disabled={copying} onClick={() => void copyLastWeek()}>
              {copying ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Copy aria-hidden className="size-4" />
              )}
              Copy last week
            </Button>
            <Button
              disabled={staff.length === 0}
              onClick={() => setDraft(newDraft(staff[0]?.id ?? "", days[0] ?? week))}
            >
              <Plus aria-hidden className="size-4" />
              Add shift
            </Button>
          </>
          )
        }
      />

      <FilterBar>
        <SegmentedControl
          label="View"
          value={view}
          onValueChange={setView}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week board" },
          ]}
        />
      </FilterBar>

      {/* Two questions, one screen: who is here now, and who is meant to be
          here this week. They read the same shifts. */}
      {view === "today" ? (
        <LiveToday buildingId={buildingId} siteName={siteName} />
      ) : (
      <>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setWeek((w) => shiftWeek(w, -1))}>
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </Button>
        <p className="font-medium text-fg">
          Week of {dayLabel(week)}
          <span className="ml-2 text-body-sm font-normal text-fg-muted">{data?.timezone ?? ""}</span>
        </p>
        {/* unlike timesheets, the roster is meant to be filled in ahead */}
        <Button variant="secondary" onClick={() => setWeek((w) => shiftWeek(w, 1))}>
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
        <MetricCard label="Rostered hours" value={hm(totals.minutes)} icon={CalendarDays} />
        <MetricCard label="Shifts" value={totals.shifts} />
        <MetricCard label="People rostered" value={totals.people} icon={Users} />
        <MetricCard
          label="Nobody rostered"
          value={totals.unrostered}
          context={totals.unrostered > 0 ? "on the site, no shifts this week" : undefined}
          tone={totals.unrostered > 0 ? "warning" : "neutral"}
        />
      </div>

      {error && (
        <Card className="mb-6">
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading the week…
          </CardBody>
        </Card>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No cleaners at this site yet"
          description="Add people in Staff first — a roster needs somebody to roster."
        />
      ) : (
        <Card className="overflow-x-auto">
          {/* A board, not a table: the left column stays put while the week
              scrolls on a laptop or a phone. */}
          <div className="min-w-[52rem]">
            <div className="grid grid-cols-[12rem_repeat(7,minmax(0,1fr))] border-b border-edge">
              <div className="px-4 py-3 text-caption text-fg-muted">Cleaner</div>
              {days.map((d) => (
                <div
                  key={d}
                  className={cn(
                    "px-3 py-3 text-center",
                    d === today && "bg-accent-subtle"
                  )}
                >
                  <p className="text-body-sm font-semibold text-fg">{dayName(d)}</p>
                  <p className="text-caption text-fg-muted">{dayNumber(d)}</p>
                </div>
              ))}
            </div>

            {staff.map((person) => (
              <div
                key={person.id}
                className="grid grid-cols-[12rem_repeat(7,minmax(0,1fr))] border-b border-edge last:border-b-0"
              >
                <div className="px-4 py-3">
                  <p className="font-medium text-fg">{person.name}</p>
                  <p className="mt-0.5 text-caption text-fg-muted">
                    {person.rostered_minutes > 0 ? hm(person.rostered_minutes) : "not rostered"}
                    {person.role ? ` · ${person.role}` : ""}
                  </p>
                </div>

                {days.map((d) => {
                  const cell = shifts.filter((s) => s.staff_id === person.id && s.work_date === d);
                  return (
                    <div
                      key={d}
                      className={cn(
                        "flex flex-col gap-1 border-l border-edge p-1.5",
                        d === today && "bg-accent-subtle/40"
                      )}
                    >
                      {cell.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setDraft(draftOf(s))}
                          className="rounded-control bg-accent-subtle px-2 py-1.5 text-left transition-colors hover:bg-hover"
                        >
                          <span className="block font-numeric text-body-sm font-semibold text-accent-text tabular-nums">
                            {minToTime(s.start_min)}–{minToTime(s.end_min)}
                          </span>
                          {s.zone && (
                            <span className="block truncate text-caption text-fg-secondary">
                              {s.zone}
                            </span>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label={`Add a shift for ${person.name} on ${dayLabel(d)}`}
                        onClick={() => setDraft(newDraft(person.id, d))}
                        className={cn(
                          "flex min-h-11 items-center justify-center rounded-control",
                          "border border-dashed border-edge text-fg-muted",
                          "transition-colors hover:border-edge-strong hover:bg-hover hover:text-fg"
                        )}
                      >
                        <Plus aria-hidden className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && staff.length > 0 && totals.shifts === 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
          <Badge tone="neutral">empty week</Badge>
          Nothing rostered yet — add a shift, or copy last week.
        </p>
      )}

      </>
      )}

      <ShiftModal
        draft={draft}
        week={week}
        buildingId={buildingId}
        data={data}
        onClose={() => setDraft(null)}
        onSaved={load}
      />
    </>
  );
}
