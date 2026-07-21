"use client";

import * as React from "react";
import { BellRing, CalendarDays, Plus, UserPlus } from "lucide-react";
import { AttendanceTimeline } from "@/components/ui/attendance-timeline";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import {
  dateKey,
  decHours,
  deriveMissedAlerts,
  deriveShift,
  staffDirectory,
  useAttendanceReady,
  useAttendanceStore,
  type ShiftView,
} from "@/lib/attendance-store";
import { fmtTime, shiftStatusMeta } from "@/lib/demo-data";

/**
 * Roster — live view over the attendance store: statuses derive from real
 * kiosk events (check in on /kiosk and this page updates). Add shift writes
 * a real rostered shift that the kiosk + timesheets immediately honour.
 */

function fmtClock(d?: Date): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ShiftDrawer({ view, dayLabel }: { view: ShiftView; dayLabel: string }) {
  const meta = shiftStatusMeta[view.status];
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm">
          Details
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{view.staff.name}</DrawerTitle>
          <DrawerDescription>
            {view.shift.zone} · {dayLabel}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Status</p>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Scheduled</p>
            <p className="font-mono text-body-sm text-fg">
              {fmtTime(view.shift.start)}–{fmtTime(view.shift.end)}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Checked in</p>
            <p className="font-mono text-body-sm text-fg">{fmtClock(view.checkIn)}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Checked out</p>
            <p className="font-mono text-body-sm text-fg">{fmtClock(view.checkOut)}</p>
          </div>
          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Supervisor note</p>
            <p className="mt-1 text-body-sm text-fg-muted">
              {view.status === "missed"
                ? `No check-in within 15 minutes of ${fmtTime(view.shift.start)} — alert raised, reassignment pending.`
                : view.status === "late"
                  ? `Checked in ${fmtClock(view.checkIn)} against a ${fmtTime(view.shift.start)} start.`
                  : "No notes for this shift."}
            </p>
          </div>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary">Edit shift</Button>
          <Button>Reassign</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function AddShiftModal({ now }: { now: Date }) {
  const addShift = useAttendanceStore((s) => s.addShift);
  const addShiftPattern = useAttendanceStore((s) => s.addShiftPattern);
  const addStaff = useAttendanceStore((s) => s.addStaff);
  const customStaff = useAttendanceStore((s) => s.customStaff);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [staffId, setStaffId] = React.useState(staffDirectory[0]!.id);
  const [newCleaner, setNewCleaner] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [staffError, setStaffError] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState<"one-off" | "ongoing" | "temporary">("one-off");
  const [date, setDate] = React.useState(dateKey(now));
  const [endDate, setEndDate] = React.useState("");
  const [weekdays, setWeekdays] = React.useState<number[]>([0, 1, 2, 3, 4]); // Mon–Fri
  const [start, setStart] = React.useState("06:00");
  const [end, setEnd] = React.useState("10:00");
  const [zone, setZone] = React.useState("");

  // customStaff in the deps keeps the options fresh after an add
  const staffOptions = React.useMemo(
    () => staffDirectory.map((s) => ({ value: s.id, label: `${s.name} · ${s.role}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customStaff]
  );

  const toDec = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  };
  const valid =
    zone.trim().length > 0 &&
    toDec(end) > toDec(start) &&
    (!newCleaner || (newName.trim().length >= 2 && /^\d{4}$/.test(newPin))) &&
    (duration === "one-off" || weekdays.length > 0) &&
    (duration !== "temporary" || (!!endDate && endDate >= date));

  const label = "flex flex-col gap-1.5 text-body-sm font-medium text-fg";

  const submit = () => {
    let id = staffId;
    let cleanerName = staffDirectory.find((s) => s.id === staffId)?.name ?? "";
    if (newCleaner) {
      const res = addStaff({ name: newName, pin: newPin });
      if (!res.ok || !res.staff) {
        setStaffError(res.error ?? "Couldn't add the cleaner");
        return;
      }
      id = res.staff.id;
      cleanerName = res.staff.name;
    }
    if (duration === "one-off") {
      addShift({ staffId: id, date, start: toDec(start), end: toDec(end), zone: zone.trim() });
    } else {
      addShiftPattern({
        staffId: id,
        zone: zone.trim(),
        start: toDec(start),
        end: toDec(end),
        kind: duration,
        startDate: date,
        endDate: duration === "temporary" ? endDate : undefined,
        weekdays,
      });
    }
    setOpen(false);
    setZone("");
    setNewCleaner(false);
    setNewName("");
    setNewPin("");
    setStaffError(null);
    toast({
      tone: "success",
      title: newCleaner
        ? `${cleanerName} added — shift rostered`
        : duration === "one-off"
          ? "Shift added to the roster"
          : duration === "ongoing"
            ? "Ongoing shift set — every rostered week from now"
            : `Temporary shift set — ${date} to ${endDate}`,
      description: `${cleanerName} · ${start}–${end}${newCleaner ? ` · kiosk PIN ${newPin}` : ""}`,
    });
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button>
          <Plus aria-hidden /> Add shift
        </Button>
      </ModalTrigger>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Add a rostered shift</ModalTitle>
          <ModalDescription>
            The kiosk, timesheets and missed-check-in alerts pick it up immediately.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          <div className="rounded-card border border-edge bg-canvas p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-body-sm font-medium text-fg">Cleaner</p>
              <button
                type="button"
                onClick={() => {
                  setNewCleaner((v) => !v);
                  setStaffError(null);
                }}
                className="flex items-center gap-1.5 text-body-sm font-medium text-accent-text transition-opacity hover:opacity-80"
              >
                <UserPlus aria-hidden className="size-4" />
                {newCleaner ? "Pick an existing cleaner instead" : "Add a new cleaner"}
              </button>
            </div>
            <div className="mt-3">
              {newCleaner ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <label className={label}>
                    Full name
                    <Input
                      placeholder="e.g. Priya Nair"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </label>
                  <label className={label}>
                    Kiosk PIN (4 digits)
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="e.g. 7412"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  {staffError && (
                    <p className="text-caption text-critical-text sm:col-span-2">{staffError}</p>
                  )}
                  <p className="text-caption text-fg-muted sm:col-span-2">
                    They can check in at the kiosk with this PIN straight away.
                  </p>
                </div>
              ) : (
                <Select options={staffOptions} value={staffId} onValueChange={setStaffId} />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-body-sm font-medium text-fg">Duration</p>
            <SegmentedControl
              label="Shift duration"
              options={[
                { value: "one-off", label: "One-off" },
                { value: "ongoing", label: "Ongoing (permanent)" },
                { value: "temporary", label: "Temporary" },
              ]}
              value={duration}
              onValueChange={(v) => setDuration(v as typeof duration)}
            />
            <p className="text-caption text-fg-muted">
              {duration === "one-off"
                ? "A single shift on one date."
                : duration === "ongoing"
                  ? "A standing arrangement — repeats on the chosen days every week until you end it."
                  : "Ad-hoc cover for a fixed period, e.g. 1–2 months — repeats on the chosen days until the end date."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <label className={label}>
              {duration === "one-off" ? "Date" : "Start date"}
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {duration === "temporary" && (
              <label className={label}>
                End date
                <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            )}
            <label className={label}>
              Start time
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={label}>
              Finish time
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>

          {duration !== "one-off" && (
            <div className="flex flex-col gap-1.5">
              <p className="text-body-sm font-medium text-fg">On days</p>
              <div className="flex flex-wrap gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={weekdays.includes(i)}
                    onClick={() =>
                      setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))
                    }
                    className={
                      weekdays.includes(i)
                        ? "rounded-pill border border-edge-strong bg-accent-subtle px-3 py-1 text-body-sm font-medium text-accent-text"
                        : "rounded-pill border border-edge px-3 py-1 text-body-sm font-medium text-fg-secondary hover:text-fg"
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className={label}>
            Zone
            <Input placeholder="e.g. L9–L24" value={zone} onChange={(e) => setZone(e.target.value)} />
          </label>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={submit}>
            {newCleaner
              ? "Add cleaner & shift"
              : duration === "one-off"
                ? "Add shift"
                : duration === "ongoing"
                  ? "Set ongoing shift"
                  : "Set temporary shift"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function RosterPage() {
  const now = useAttendanceReady();
  const shifts = useAttendanceStore((s) => s.shifts);
  const events = useAttendanceStore((s) => s.events);

  const shiftPatterns = useAttendanceStore((s) => s.shiftPatterns);
  const patternKind = (id: string) => shiftPatterns.find((pt) => pt.id === id)?.kind;

  const [view, setView] = React.useState("day");
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");

  if (!now) return null;

  const todaySelfie = (staffId: string, kind: "in" | "out"): string | undefined =>
    [...events]
      .filter((e) => e.staffId === staffId && e.kind === kind && e.selfie && dateKey(new Date(e.at)) === dateKey(now))
      .pop()?.selfie;

  const today = dateKey(now);
  const todayLabel = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const views = shifts
    .filter((s) => s.date === today)
    .map((s) => deriveShift(s, events, now))
    .sort((a, b) => a.shift.start - b.shift.start);
  const missed = deriveMissedAlerts(shifts, events, now);

  const filtered = views.filter(
    (v) =>
      (status === "all" || v.status === status) &&
      v.staff.name.toLowerCase().includes(query.toLowerCase())
  );

  // timeline window hugs the day's real shifts (the demo cast anchors to the
  // clock, so a fixed 05:00–14:00 axis overflowed in the afternoon/evening)
  const spans = filtered.flatMap((v) => [
    v.shift.start,
    v.shift.end,
    ...(v.checkIn ? [decHours(v.checkIn)] : []),
    ...(v.checkOut ? [decHours(v.checkOut)] : []),
  ]);
  const timelineWindow: [number, number] = spans.length
    ? [
        Math.max(0, Math.floor(Math.min(...spans, decHours(now)) - 1)),
        Math.min(24, Math.ceil(Math.max(...spans, decHours(now)) + 1)),
      ]
    : [5, 14];

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Roster"
        description="Scheduled shifts, live check-ins and exceptions for Aurora on Collins"
        actions={
          <>
            <Button variant="secondary">
              <CalendarDays aria-hidden /> Week of{" "}
              {monday.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </Button>
            <AddShiftModal now={now} />
          </>
        }
      />

      {missed.length > 0 && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-card border border-edge bg-critical-subtle p-4"
        >
          <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-critical-text" />
          <div>
            <p className="text-body-sm font-medium text-critical-text">
              {missed.length === 1 ? "Missed check-in" : `${missed.length} missed check-ins`} — alert
              raised
            </p>
            <p className="mt-0.5 text-body-sm text-fg-secondary">
              {missed
                .map(
                  (m) =>
                    `${m.staff.name} (${fmtTime(m.shift.start)} start, ${m.overdueMin} min overdue)`
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      <FilterBar>
        <SegmentedControl
          label="Roster view"
          value={view}
          onValueChange={setView}
          options={[
            { value: "day", label: "Today" },
            { value: "week", label: "This week" },
            { value: "timeline", label: "Timeline · today" },
          ]}
        />
        <Select
          className="w-52"
          options={[
            { value: "all", label: "All statuses" },
            { value: "on-site", label: "On site now" },
            { value: "late", label: "Started late" },
            { value: "missed", label: "Missed check-in" },
            { value: "completed", label: "Completed" },
            { value: "rostered", label: "Rostered" },
          ]}
          value={status}
          onValueChange={setStatus}
        />
        <SearchInput
          className="w-64"
          placeholder="Find a cleaner…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No shifts match those filters"
          description={`Try a different status or clear the search — today's roster has ${views.length} shifts in total.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatus("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "week" ? (
        <div className="grid gap-4 md:grid-cols-5">
          {weekDays.map((day) => {
            const key = dateKey(day);
            const isToday = key === today;
            const dayViews = shifts
              .filter((s) => s.date === key)
              .map((s) => deriveShift(s, events, now))
              .filter((v) => v.staff.name.toLowerCase().includes(query.toLowerCase()))
              .sort((a, b) => a.shift.start - b.shift.start);
            return (
              <div key={key} className="flex flex-col gap-3">
                <p
                  className={`text-body-sm font-medium ${isToday ? "text-accent-text" : "text-fg-muted"}`}
                >
                  {day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}
                  {isToday && " · today"}
                </p>
                {dayViews.length === 0 && (
                  <p className="text-caption text-fg-muted">No shifts rostered</p>
                )}
                {dayViews.map((v) => {
                  const meta = shiftStatusMeta[v.status];
                  return (
                    <div
                      key={v.shift.id}
                      className="rounded-card border border-edge bg-surface p-3.5 shadow-card"
                    >
                      <p className="truncate text-body-sm font-medium text-fg">{v.staff.name}</p>
                      <p className="mt-0.5 font-mono text-caption text-fg-muted">
                        {fmtTime(v.shift.start)}–{fmtTime(v.shift.end)}
                      </p>
                      <div className="mt-2.5">
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : view === "timeline" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                Timeline — today,{" "}
                {now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
              </CardTitle>
              <p className="mt-1 text-body-sm text-fg-muted">
                Rostered bar vs actual kiosk time, live. Future days live in This week; monthly
                planning is on the Calendar.
              </p>
            </div>
            <StatusPill tone="accent">Live</StatusPill>
          </CardHeader>
          <CardBody>
            <AttendanceTimeline
              now={decHours(now)}
              windowStart={timelineWindow[0]}
              windowEnd={timelineWindow[1]}
              rows={filtered.map((v) => ({
                name: v.staff.name,
                zone: v.shift.zone,
                scheduled: [v.shift.start, v.shift.end],
                actual: v.checkIn
                  ? [decHours(v.checkIn), v.checkOut ? decHours(v.checkOut) : null]
                  : undefined,
                status: v.status === "rostered" ? "completed" : v.status,
              }))}
            />
          </CardBody>
        </Card>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Cleaner</Th>
              <Th>Zone</Th>
              <Th numeric>Scheduled</Th>
              <Th numeric>Check-in</Th>
              <Th numeric>Check-out</Th>
              <Th>Status</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filtered.map((v) => {
              const meta = shiftStatusMeta[v.status];
              return (
                <Tr key={v.shift.id}>
                  <Td className="font-medium">
                    {v.staff.name}
                    {v.shift.patternId && (
                      <span className="ml-2 align-middle">
                        <StatusPill tone={patternKind(v.shift.patternId) === "ongoing" ? "accent" : "info"}>
                          {patternKind(v.shift.patternId) === "ongoing" ? "Ongoing" : "Temp"}
                        </StatusPill>
                      </span>
                    )}
                  </Td>
                  <Td className="text-fg-secondary">{v.shift.zone}</Td>
                  <Td numeric>
                    {fmtTime(v.shift.start)}–{fmtTime(v.shift.end)}
                  </Td>
                  <Td numeric>
                    <span className="inline-flex items-center justify-end gap-2">
                      {todaySelfie(v.staff.id, "in") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={todaySelfie(v.staff.id, "in")}
                          alt={`${v.staff.name} check-in photo`}
                          className="size-7 rounded-sm border border-edge object-cover"
                        />
                      )}
                      {fmtClock(v.checkIn)}
                    </span>
                  </Td>
                  <Td numeric>
                    <span className="inline-flex items-center justify-end gap-2">
                      {todaySelfie(v.staff.id, "out") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={todaySelfie(v.staff.id, "out")}
                          alt={`${v.staff.name} check-out photo`}
                          className="size-7 rounded-sm border border-edge object-cover"
                        />
                      )}
                      {fmtClock(v.checkOut)}
                    </span>
                  </Td>
                  <Td>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </Td>
                  <Td className="text-right">
                    <ShiftDrawer view={v} dayLabel={todayLabel} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
