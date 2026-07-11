"use client";

import * as React from "react";
import { BellRing, CalendarDays, Plus } from "lucide-react";
import { AttendanceTimeline } from "@/components/ui/attendance-timeline";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
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

function AddShiftDrawer({ now }: { now: Date }) {
  const addShift = useAttendanceStore((s) => s.addShift);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [staffId, setStaffId] = React.useState(staffDirectory[0]!.id);
  const [date, setDate] = React.useState(dateKey(now));
  const [start, setStart] = React.useState("06:00");
  const [end, setEnd] = React.useState("10:00");
  const [zone, setZone] = React.useState("");

  const toDec = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  };
  const valid = zone.trim().length > 0 && toDec(end) > toDec(start);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus aria-hidden /> Add shift
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add a rostered shift</DrawerTitle>
          <DrawerDescription>
            The kiosk, timesheets and missed-check-in alerts pick it up immediately.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Cleaner
            <Select
              options={staffDirectory.map((s) => ({ value: s.id, label: s.name }))}
              value={staffId}
              onValueChange={setStaffId}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Date
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
              Start
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
              End
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Zone
            <Input
              placeholder="e.g. L9–L24"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
          </label>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              addShift({ staffId, date, start: toDec(start), end: toDec(end), zone: zone.trim() });
              setOpen(false);
              setZone("");
              toast({
                tone: "success",
                title: "Shift added to the roster",
                description: `${staffDirectory.find((s) => s.id === staffId)?.name} · ${date} ${start}–${end}`,
              });
            }}
          >
            Add shift
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default function RosterPage() {
  const now = useAttendanceReady();
  const shifts = useAttendanceStore((s) => s.shifts);
  const events = useAttendanceStore((s) => s.events);

  const [view, setView] = React.useState("day");
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");

  if (!now) return null;

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
            <AddShiftDrawer now={now} />
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
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "timeline", label: "Timeline" },
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
          <CardBody>
            <AttendanceTimeline
              now={decHours(now)}
              windowStart={5}
              windowEnd={14}
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
              <Th numeric>Duration</Th>
              <Th>Status</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filtered.map((v) => {
              const meta = shiftStatusMeta[v.status];
              const dur =
                v.checkIn && v.checkOut
                  ? ((v.checkOut.getTime() - v.checkIn.getTime()) / 3600000).toFixed(2)
                  : "—";
              return (
                <Tr key={v.shift.id}>
                  <Td className="font-medium">{v.staff.name}</Td>
                  <Td className="text-fg-secondary">{v.shift.zone}</Td>
                  <Td numeric>
                    {fmtTime(v.shift.start)}–{fmtTime(v.shift.end)}
                  </Td>
                  <Td numeric>{fmtClock(v.checkIn)}</Td>
                  <Td numeric>{fmtClock(v.checkOut)}</Td>
                  <Td numeric>{dur}</Td>
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
