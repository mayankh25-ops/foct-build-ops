"use client";

import * as React from "react";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  calCategoryMeta,
  monthKey,
  scopeEventsForMonth,
  seededEventsForMonth,
  useCalendarReady,
  useCalendarStore,
  type CalCategory,
  type CalEvent,
} from "@/lib/calendar-store";
import { cn } from "@/lib/cn";

/**
 * Building calendar — periodic works auto-populate from the Scope agreement
 * (same cadence rules as the periodic planner), alongside contractor visits,
 * bookings, waste pickups and manual jobs. One calendar, every party.
 */

const fmtT = (t?: number) =>
  t === undefined
    ? "all day"
    : `${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

function EventChip({ e, compact }: { e: CalEvent; compact?: boolean }) {
  const meta = calCategoryMeta[e.category];
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-caption",
        meta.tone === "critical" && "bg-critical-subtle text-critical-text",
        meta.tone === "warning" && "bg-warning-subtle text-warning-text",
        meta.tone === "info" && "bg-info-subtle text-info-text",
        meta.tone === "success" && "bg-success-subtle text-success-text",
        meta.tone === "accent" && "bg-accent-subtle text-accent-text",
        meta.tone === "neutral" && "bg-hover text-fg-secondary"
      )}
      title={e.title}
    >
      <span className="truncate">{e.title}</span>
      {!compact && e.billable && <span className="shrink-0 font-mono text-caption">$</span>}
    </span>
  );
}

function DayDrawer({
  date,
  events,
  children,
}: {
  date: Date;
  events: CalEvent[];
  children: React.ReactNode;
}) {
  const removeJob = useCalendarStore((s) => s.removeJob);
  const { toast } = useToast();
  return (
    <Drawer>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </DrawerTitle>
          <DrawerDescription>
            {events.length} scheduled item{events.length === 1 ? "" : "s"} at Aurora on Collins
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          {events.length === 0 && (
            <p className="text-body-sm text-fg-muted">Nothing scheduled — use Add job to book work in.</p>
          )}
          {events
            .sort((a, b) => (a.time ?? 24) - (b.time ?? 24))
            .map((e) => {
              const meta = calCategoryMeta[e.category];
              return (
                <div key={e.id} className="rounded-card border border-edge bg-canvas p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-body-sm font-medium text-fg">{e.title}</p>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                  <p className="mt-1.5 font-mono text-caption text-fg-muted">{fmtT(e.time)}</p>
                  {e.detail && <p className="mt-1.5 text-body-sm text-fg-secondary">{e.detail}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    {e.billable && <Badge tone="warning">Billable extra — quote first</Badge>}
                    {e.source === "scope" && <Badge tone="neutral">From the agreement</Badge>}
                    {e.source === "manual" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeJob(e.id);
                          toast({ tone: "neutral", title: "Job removed", description: e.title });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function AddJobDrawer({ defaultDate }: { defaultDate: string }) {
  const addJob = useCalendarStore((s) => s.addJob);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(defaultDate);
  const [time, setTime] = React.useState("09:00");
  const [allDay, setAllDay] = React.useState(false);
  const [category, setCategory] = React.useState<CalCategory>("contractor");
  const [detail, setDetail] = React.useState("");

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <CalendarPlus aria-hidden /> Add job
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add a calendar job</DrawerTitle>
          <DrawerDescription>Visible to every party on the building calendar.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Title
            <Input
              placeholder="e.g. Carpet extraction — L14 corridor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Category
            <Select
              options={Object.entries(calCategoryMeta).map(([value, m]) => ({ value, label: m.label }))}
              value={category}
              onValueChange={(v) => setCategory(v as CalCategory)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
              Date
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
              Time
              <Input type="time" value={time} disabled={allDay} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-body-sm text-fg">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            All-day
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Notes
            <Input
              placeholder="Access, inductions, who to notify…"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !date}
            onClick={() => {
              const [h, m] = time.split(":").map(Number);
              addJob({
                title: title.trim(),
                date,
                time: allDay ? undefined : (h ?? 0) + (m ?? 0) / 60,
                category,
                detail: detail.trim() || undefined,
              });
              setOpen(false);
              setTitle("");
              setDetail("");
              toast({ tone: "success", title: "Job added to the calendar", description: title.trim() });
            }}
          >
            Add job
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default function CalendarPage() {
  const ready = useCalendarReady();
  const manualEvents = useCalendarStore((s) => s.manualEvents);
  const [cursor, setCursor] = React.useState<Date | null>(null);
  const [filter, setFilter] = React.useState<CalCategory | "all">("all");

  React.useEffect(() => {
    setCursor((c) => c ?? new Date());
  }, []);

  if (!ready || !cursor) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = monthKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const monthEvents = [
    ...scopeEventsForMonth(year, month),
    ...seededEventsForMonth(year, month),
    ...manualEvents,
  ].filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`));

  const shown = monthEvents.filter((e) => filter === "all" || e.category === filter);
  const byDate = new Map<string, CalEvent[]>();
  for (const e of shown) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-start offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const periodicCount = monthEvents.filter((e) => e.category === "periodic").length;

  return (
    <>
      <PageHeader
        eyebrow="Building · Shared calendar"
        title="Calendar"
        description={`Periodic works land here straight from the cleaning agreement — ${periodicCount} scope items due this month — alongside contractor visits, bookings and waste pickups.`}
        actions={<AddJobDrawer defaultDate={monthKey(year, month, Math.min(15, daysInMonth))} />}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <p className="min-w-40 text-center font-display text-title-2 text-fg">
            {cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
          </p>
          <Button variant="secondary" size="sm" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-pill border px-3 py-1 text-body-sm font-medium",
              filter === "all" ? "border-edge-strong bg-hover text-fg" : "border-edge text-fg-secondary hover:text-fg"
            )}
            onClick={() => setFilter("all")}
          >
            All · {monthEvents.length}
          </button>
          {(Object.keys(calCategoryMeta) as CalCategory[]).map((c) => {
            const count = monthEvents.filter((e) => e.category === c).length;
            if (!count) return null;
            return (
              <button
                key={c}
                type="button"
                className={cn(
                  "rounded-pill border px-3 py-1 text-body-sm font-medium",
                  filter === c ? "border-edge-strong bg-hover text-fg" : "border-edge text-fg-secondary hover:text-fg"
                )}
                onClick={() => setFilter(filter === c ? "all" : c)}
              >
                {calCategoryMeta[c].label} · {count}
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="grid grid-cols-7 border-b border-edge">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <p key={d} className="px-3 py-2.5 text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (!d)
                return <div key={i} className={cn("min-h-28 border-b border-edge bg-canvas/50", (i + 1) % 7 !== 0 && "border-r")} />;
              const key = monthKey(d.getFullYear(), d.getMonth(), d.getDate());
              const dayEvents = (byDate.get(key) ?? []).sort((a, b) => (a.time ?? 24) - (b.time ?? 24));
              const isToday = key === todayKey;
              return (
                <DayDrawer key={i} date={d} events={dayEvents}>
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-28 flex-col items-stretch gap-1 border-b border-edge p-2 text-left transition-colors hover:bg-hover",
                      (i + 1) % 7 !== 0 && "border-r"
                    )}
                  >
                    <span
                      className={cn(
                        "mb-0.5 inline-flex size-6 items-center justify-center self-start rounded-pill font-numeric text-body-sm tabular-nums",
                        isToday ? "bg-accent font-semibold text-on-accent" : "text-fg-secondary"
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {dayEvents.slice(0, 3).map((e) => (
                      <EventChip key={e.id} e={e} compact />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1 text-caption text-fg-muted">+{dayEvents.length - 3} more</span>
                    )}
                  </button>
                </DayDrawer>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <p className="mt-4 text-body-sm text-fg-muted">
        Periodic chips come straight from the FOCT Cleaning service agreement — the same dataset as
        the Scope module’s periodic planner. Billable extras are marked <span className="font-mono">$</span> and
        must be quoted before scheduling.
      </p>
    </>
  );
}
