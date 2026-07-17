"use client";

import * as React from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Lock, Phone, Repeat } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  CAL_ROLES,
  calCategoryMeta,
  calRoleLabel,
  canModify,
  manualEventsForMonth,
  monthKey,
  REPEAT_LABELS,
  scopeEventsForMonth,
  seededEventsForMonth,
  seriesEventsForMonth,
  useCalendarReady,
  useCalendarStore,
  visibleTo,
  type CalCategory,
  type CalEvent,
  type CalRepeat,
  type CalRole,
  type CalVisibility,
} from "@/lib/calendar-store";
import { cn } from "@/lib/cn";

/**
 * Building calendar — periodic works auto-populate from the Scope agreement,
 * alongside contractor visits, bookings, waste pickups, and (2026-07-15)
 * RECURRING events with role-scoped visibility and admin-locked schedules.
 * One calendar, every party — each sees exactly what they're meant to.
 */

const fmtT = (t?: number) =>
  t === undefined
    ? "all day"
    : `${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

const fmtRange = (e: Pick<CalEvent, "time" | "endTime">) =>
  e.time === undefined ? "all day" : e.endTime !== undefined ? `${fmtT(e.time)} – ${fmtT(e.endTime)}` : fmtT(e.time);

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const parseTime = (value: string): number | undefined => {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

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
      {e.seriesId && <Repeat aria-label="Repeats" className="size-3 shrink-0" />}
      {e.locked && <Lock aria-label="Locked by admin" className="size-3 shrink-0" />}
      <span className="truncate">{e.title}</span>
      {!compact && e.billable && <span className="shrink-0 font-mono text-caption">$</span>}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility?: CalVisibility }) {
  if (!visibility || visibility === "everyone") return null;
  return (
    <Badge tone="info">Only: {visibility.map((r) => calRoleLabel(r)).join(" · ")}</Badge>
  );
}

function DayDrawer({
  date,
  events,
  viewRole,
  onClose,
}: {
  date: Date | null;
  events: CalEvent[];
  viewRole: CalRole;
  onClose: () => void;
}) {
  const removeJob = useCalendarStore((s) => s.removeJob);
  const removeSeries = useCalendarStore((s) => s.removeSeries);
  const { toast } = useToast();
  // the Root stays mounted and is driven by `open` — unmounting an open Radix
  // dialog mid-close leaks body pointer-events and strands the page
  return (
    <Drawer open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {date?.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
          </DrawerTitle>
          <DrawerDescription>
            {events.length} scheduled item{events.length === 1 ? "" : "s"} at Aurora on Collins
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          {events.length === 0 && (
            <p className="text-body-sm text-fg-muted">Nothing scheduled — use Add event to book work in.</p>
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
                  <p className="mt-1.5 font-mono text-caption text-fg-muted">{fmtRange(e)}</p>
                  {e.detail && <p className="mt-1.5 text-body-sm text-fg-secondary">{e.detail}</p>}
                  {(e.contactName || e.contactPhone) && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-fg-secondary">
                      <Phone aria-hidden className="size-3.5 text-fg-muted" />
                      {e.contactName}
                      {e.contactPhone && (
                        <a href={`tel:${e.contactPhone.replace(/\s/g, "")}`} className="font-mono text-accent-text hover:underline">
                          {e.contactPhone}
                        </a>
                      )}
                    </p>
                  )}
                  {e.reminder && (
                    <p className="mt-1.5 text-caption text-fg-muted">
                      ✉ Reminder to <span className="font-mono">{e.reminder.email}</span>{" "}
                      {e.reminder.daysBefore === 0 ? "on the day" : `${e.reminder.daysBefore} day${e.reminder.daysBefore === 1 ? "" : "s"} before`}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {e.repeat && e.repeat !== "none" && (
                      <Badge tone="accent">
                        <Repeat aria-hidden className="mr-1 inline size-3" />
                        {REPEAT_LABELS[e.repeat]}
                      </Badge>
                    )}
                    {e.endDate && e.endDate > (e.spanId ? "" : e.date) && e.spanId && (
                      <Badge tone="info">Multi-day · until {e.endDate.slice(5)}</Badge>
                    )}
                    <VisibilityBadge visibility={e.visibility} />
                    {e.locked && (
                      <Badge tone="neutral">
                        <Lock aria-hidden className="mr-1 inline size-3" />
                        Set by building admin
                      </Badge>
                    )}
                    {e.billable && <Badge tone="warning">Billable extra — quote first</Badge>}
                    {e.source === "scope" && <Badge tone="neutral">From the agreement</Badge>}
                    {e.source === "manual" &&
                      (canModify(e, viewRole) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (e.seriesId) {
                              removeSeries(e.seriesId);
                              toast({ tone: "neutral", title: "Recurring event removed", description: `${e.title} — the whole series` });
                            } else {
                              removeJob(e.spanId ?? e.id);
                              toast({ tone: "neutral", title: e.spanId ? "Multi-day event removed" : "Event removed", description: e.title });
                            }
                          }}
                        >
                          {e.seriesId ? "Remove series" : "Remove"}
                        </Button>
                      ) : (
                        <span className="text-caption text-fg-muted">Only the building admin can change this</span>
                      ))}
                  </div>
                </div>
              );
            })}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- */
/* Add event — BIG centred modal, task-reminder-app style            */
/* ---------------------------------------------------------------- */

function AddEventModal({ defaultDate, viewRole }: { defaultDate: string; viewRole: CalRole }) {
  const addJob = useCalendarStore((s) => s.addJob);
  const addSeries = useCalendarStore((s) => s.addSeries);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(defaultDate);
  const [start, setStart] = React.useState("09:00");
  const [finish, setFinish] = React.useState("");
  const [allDay, setAllDay] = React.useState(false);
  const [category, setCategory] = React.useState<CalCategory>("contractor");
  const [detail, setDetail] = React.useState("");
  const [repeat, setRepeat] = React.useState<CalRepeat>("none");
  const [weekdays, setWeekdays] = React.useState<number[]>([]);
  const [endDate, setEndDate] = React.useState("");
  const [visibility, setVisibility] = React.useState<"everyone" | CalRole[]>("everyone");
  const [locked, setLocked] = React.useState(false);
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [remindEmail, setRemindEmail] = React.useState("");
  const [remindDays, setRemindDays] = React.useState("1");

  const reset = () => {
    setTitle("");
    setDetail("");
    setRepeat("none");
    setWeekdays([]);
    setEndDate("");
    setVisibility("everyone");
    setLocked(false);
    setContactName("");
    setContactPhone("");
    setRemindEmail("");
  };

  const toggleRole = (role: CalRole) => {
    setVisibility((v) => {
      const list = v === "everyone" ? [] : [...v];
      const next = list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
      return next.length === 0 ? "everyone" : next;
    });
  };

  const submit = () => {
    const reminder = remindEmail.trim()
      ? { email: remindEmail.trim(), daysBefore: Number(remindDays) }
      : undefined;
    const shared = {
      title: title.trim(),
      time: allDay ? undefined : parseTime(start),
      endTime: allDay ? undefined : parseTime(finish),
      category,
      detail: detail.trim() || undefined,
      reminder,
      visibility,
      locked: viewRole === "admin" ? locked : false,
      createdBy: viewRole,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
    };
    if (repeat === "none") {
      addJob({ ...shared, date, endDate: endDate && endDate > date ? endDate : undefined });
    } else {
      addSeries({
        ...shared,
        startDate: date,
        until: endDate || undefined,
        repeat,
        weekdays: weekdays.length ? weekdays : undefined,
        visibility,
        createdBy: viewRole,
      });
    }
    setOpen(false);
    reset();
    toast({
      tone: "success",
      title: repeat === "none" ? "Event added to the calendar" : `Recurring event added — ${REPEAT_LABELS[repeat].toLowerCase()}`,
      description: reminder ? `${title.trim()} · reminder to ${reminder.email} queued` : title.trim(),
    });
  };

  const label = "flex flex-col gap-1.5 text-body-sm font-medium text-fg";

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button>
          <CalendarPlus aria-hidden /> Add event
        </Button>
      </ModalTrigger>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Add a calendar event</ModalTitle>
          <ModalDescription>
            One-off or recurring. Creating as <strong>{calRoleLabel(viewRole)}</strong> — choose who
            can see it below.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          <label className={label}>
            Title
            <Input
              placeholder="e.g. Floor maintenance — L14 corridor (night shift)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={label}>
              Category
              <Select
                options={Object.entries(calCategoryMeta)
                  .filter(([value]) => value !== "periodic")
                  .map(([value, m]) => ({ value, label: m.label }))}
                value={category}
                onValueChange={(v) => setCategory(v as CalCategory)}
              />
            </label>
            <label className={label}>
              Start date
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={label}>
              Finish date (optional)
              <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          <p className="-mt-3 text-caption text-fg-muted">
            {repeat === "none"
              ? "A finish date makes it a multi-day event — it shows on every day in between."
              : `Repeats ${REPEAT_LABELS[repeat].toLowerCase()} from the start date${endDate ? ` until ${endDate}` : " with no end"}.`}
          </p>

          <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className={label}>
              Start time
              <Input type="time" value={start} disabled={allDay} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={label}>
              Finish time
              <Input type="time" value={finish} disabled={allDay} onChange={(e) => setFinish(e.target.value)} />
            </label>
            <label className="flex h-11 items-center gap-2 text-body-sm text-fg">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              All-day
            </label>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Repeats
                <Select
                  options={Object.entries(REPEAT_LABELS).map(([value, l]) => ({ value, label: l }))}
                  value={repeat}
                  onValueChange={(v) => setRepeat(v as CalRepeat)}
                />
              </label>
            </div>
            {(repeat === "weekly" || repeat === "fortnightly") && (
              <div className="mt-3">
                <p className="text-body-sm font-medium text-fg">On days</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={weekdays.includes(i)}
                      onClick={() =>
                        setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))
                      }
                      className={cn(
                        "rounded-pill border px-3 py-1 text-body-sm font-medium transition-colors",
                        weekdays.includes(i)
                          ? "border-edge-strong bg-accent-subtle text-accent-text"
                          : "border-edge text-fg-secondary hover:text-fg"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-caption text-fg-muted">
                  None picked = repeats on the first occurrence&apos;s weekday.
                </p>
              </div>
            )}
          </div>

          <label className={label}>
            Notes
            <Input
              placeholder="Access, areas booked, inductions, who to notify…"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Contact name (optional)
              <Input placeholder="e.g. Dave — StoneShine Floors" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className={label}>
              Contact phone (optional)
              <Input type="tel" placeholder="+61 4xx xxx xxx" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Who can see this event</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={visibility === "everyone"}
                onClick={() => setVisibility("everyone")}
                className={cn(
                  "rounded-pill border px-3 py-1 text-body-sm font-medium transition-colors",
                  visibility === "everyone"
                    ? "border-edge-strong bg-accent-subtle text-accent-text"
                    : "border-edge text-fg-secondary hover:text-fg"
                )}
              >
                Everyone
              </button>
              {CAL_ROLES.map((r) => {
                const active = visibility !== "everyone" && visibility.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleRole(r.value)}
                    className={cn(
                      "rounded-pill border px-3 py-1 text-body-sm font-medium transition-colors",
                      active
                        ? "border-edge-strong bg-accent-subtle text-accent-text"
                        : "border-edge text-fg-secondary hover:text-fg"
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {viewRole === "admin" && (
              <label className="mt-3 flex items-center gap-2 text-body-sm text-fg">
                <input
                  type="checkbox"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="size-4 accent-[var(--accent)]"
                />
                <Lock aria-hidden className="size-3.5 text-fg-muted" />
                Lock this event — only the building admin can change or remove it
              </label>
            )}
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Email reminder (optional)</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              Any address — contractor, BM, committee member. Sends via the org&apos;s email provider.
            </p>
            <div className="mt-3 grid grid-cols-[1fr_8rem] gap-2">
              <Input
                type="email"
                placeholder="name@company.com.au"
                value={remindEmail}
                onChange={(e) => setRemindEmail(e.target.value)}
              />
              <Select
                options={[
                  { value: "0", label: "On the day" },
                  { value: "1", label: "1 day before" },
                  { value: "2", label: "2 days before" },
                  { value: "7", label: "1 week before" },
                ]}
                value={remindDays}
                onValueChange={setRemindDays}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || !date || (!!endDate && endDate < date)} onClick={submit}>
            {repeat === "none" ? "Add event" : "Add recurring event"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function CalendarPage() {
  const ready = useCalendarReady();
  const manualEvents = useCalendarStore((s) => s.manualEvents);
  const series = useCalendarStore((s) => s.series);
  const viewRole = useCalendarStore((s) => s.viewRole);
  const setViewRole = useCalendarStore((s) => s.setViewRole);
  const [cursor, setCursor] = React.useState<Date | null>(null);
  const [filter, setFilter] = React.useState<CalCategory | "all">("all");
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

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
    ...seriesEventsForMonth(series, year, month),
    ...manualEventsForMonth(manualEvents, year, month),
  ]
    .filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .filter((e) => visibleTo(e, viewRole));

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
  const queuedReminders = [
    ...manualEvents.filter((e) => e.reminder),
    ...series.filter((s) => s.reminder),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Building · Shared calendar"
        title="Calendar"
        description={`Periodic works land here straight from the cleaning agreement — ${periodicCount} scope items due this month — alongside contractor visits, bookings, maintenance and recurring schedules.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label={undefined}
              className="w-44"
              options={CAL_ROLES.map((r) => ({ value: r.value, label: `Viewing as ${r.label}` }))}
              value={viewRole}
              onValueChange={(v) => setViewRole(v as CalRole)}
            />
            <AddEventModal defaultDate={monthKey(year, month, Math.min(15, daysInMonth))} viewRole={viewRole} />
          </div>
        }
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
            {WEEKDAYS.map((d) => (
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
                  <button
                    key={i}
                    type="button"
                    aria-label={`Open ${d.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}`}
                    onClick={() => setSelectedKey(key)}
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
              );
            })}
          </div>
        </CardBody>
      </Card>

      <DayDrawer
        date={selectedKey ? new Date(`${selectedKey}T12:00:00`) : null}
        events={selectedKey ? (byDate.get(selectedKey) ?? []) : []}
        viewRole={viewRole}
        onClose={() => setSelectedKey(null)}
      />

      {queuedReminders.length > 0 && (
        <Card className="mt-6">
          <CardBody>
            <p className="text-body-sm font-medium text-fg">Queued email reminders</p>
            <div className="mt-3 flex flex-col gap-2">
              {manualEvents
                .filter((e) => e.reminder)
                .map((e) => {
                  const send = new Date(`${e.date}T09:00:00`);
                  send.setDate(send.getDate() - (e.reminder?.daysBefore ?? 0));
                  return (
                    <p key={e.id} className="text-body-sm text-fg-secondary">
                      <span className="font-mono">{e.reminder!.email}</span> — “{e.title}” · sends{" "}
                      {send.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}{" "}
                      09:00
                    </p>
                  );
                })}
              {series
                .filter((s) => s.reminder)
                .map((s) => (
                  <p key={s.id} className="text-body-sm text-fg-secondary">
                    <span className="font-mono">{s.reminder!.email}</span> — “{s.title}” · before each{" "}
                    {REPEAT_LABELS[s.repeat].toLowerCase()} occurrence
                  </p>
                ))}
            </div>
            <p className="mt-3 text-caption text-fg-muted">
              Delivery runs through the org&apos;s configured email provider (see Settings →
              Integrations) once the calendar backend stage is live — reminders queue now so nothing
              set today is lost.
            </p>
          </CardBody>
        </Card>
      )}

      <p className="mt-4 text-body-sm text-fg-muted">
        Periodic chips come straight from the FOCT Cleaning service agreement — the same dataset as
        the Scope module&apos;s periodic planner. Billable extras are marked <span className="font-mono">$</span> and
        must be quoted before scheduling. Role visibility and admin locks apply exactly as they will
        under RLS at the backend stage.
      </p>
    </>
  );
}
