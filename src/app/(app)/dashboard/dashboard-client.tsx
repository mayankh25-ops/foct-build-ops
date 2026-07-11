"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Cloud,
  CloudRain,
  Flag,
  Lock,
  MapPin,
  Package,
  ScanLine,
  Wind,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveClock } from "@/components/ui/live-clock";
import { MetricCard } from "@/components/ui/metric-card";
import { MiniBarChart } from "@/components/ui/mini-bar-chart";
import { SectionHeader } from "@/components/ui/section-header";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  building,
  cameraZones,
  fmtTime,
  shiftStatusMeta,
  stock,
  zoneProgress,
} from "@/lib/demo-data";
import {
  dateKey,
  deriveMissedAlerts,
  deriveShift,
  staffById,
  useAttendanceReady,
  useAttendanceStore,
} from "@/lib/attendance-store";
import { calCategoryMeta, eventsForRange, useCalendarReady, useCalendarStore } from "@/lib/calendar-store";
import { useHandoverReady, useHandoverStore } from "@/lib/handover-store";
import { useLiveWeather } from "@/lib/live-weather";
import { useSdRehydrate, useSdStore } from "@/lib/service-desk-store";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const lowStock = stock.filter((s) => s.level <= 0.25);
const zonesTotal = zoneProgress.complete + zoneProgress.inProgress + zoneProgress.pending;
const cleanedPct = Math.round((zoneProgress.complete / zonesTotal) * 100);

function HeroStat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warning" | "critical" }) {
  return (
    <div className="rounded-control border border-edge bg-surface px-4 py-3">
      <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-numeric text-title-1 tabular-nums",
          tone === "accent" && "text-accent-text",
          tone === "warning" && "text-warning-text",
          tone === "critical" && "text-critical-text",
          !tone && "text-fg"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function fmtClock(d: Date): string {
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const activityDot: Record<"check-in" | "check-out" | "task" | "alert" | "order", string> = {
  "check-in": "bg-accent-text",
  "check-out": "bg-edge-strong",
  task: "bg-success",
  alert: "bg-critical",
  order: "bg-info",
};

export function DashboardClient() {
  const now = useAttendanceReady();
  const shiftsAll = useAttendanceStore((s) => s.shifts);
  const events = useAttendanceStore((s) => s.events);
  const weather = useLiveWeather();
  useCalendarReady();
  useHandoverReady();
  useSdRehydrate();
  const manualEvents = useCalendarStore((s) => s.manualEvents);
  const notes = useHandoverStore((s) => s.notes);
  const addNote = useHandoverStore((s) => s.addNote);
  const tickets = useSdStore((s) => s.tickets);
  const { toast } = useToast();
  const [noteText, setNoteText] = React.useState("");
  if (!now) return null;

  // calendar: due today + the coming week
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 6);
  const dueWeek = eventsForRange(now, weekEnd, manualEvents);
  const todayIso = dateKey(now);
  const dueToday = dueWeek.filter((e) => e.date === todayIso);
  const dueLater = dueWeek.filter((e) => e.date !== todayIso);

  // service desk: open tickets by status + priority
  const OPEN = ["new", "open", "in-progress", "reopened"] as const;
  const sdByStatus = OPEN.map((st) => ({
    label: st === "in-progress" ? "In progress" : st.charAt(0).toUpperCase() + st.slice(1),
    count: tickets.filter((t) => t.status === st).length,
  }));
  const sdMax = Math.max(1, ...sdByStatus.map((r) => r.count));
  const sdUrgentOpen = tickets.filter((t) => t.priority === "urgent" && OPEN.includes(t.status as (typeof OPEN)[number])).length;

  const today = dateKey(now);
  const views = shiftsAll
    .filter((s) => s.date === today)
    .map((s) => deriveShift(s, events, now))
    .sort((a, b) => a.shift.start - b.shift.start);
  const missed = deriveMissedAlerts(shiftsAll, events, now);
  const onSite = views.filter((v) => v.status === "on-site" || v.status === "late").length;
  const late = views.filter((v) => v.status === "late").length;
  const checkInsToday = events.filter(
    (e) => e.kind === "in" && dateKey(new Date(e.at)) === today
  ).length;
  const done = views.filter((v) => v.status === "completed").length;

  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = dateKey(d);
    const dayShifts = shiftsAll.filter((s) => s.date === key);
    const rostered = dayShifts.reduce((n, s) => n + s.end - s.start, 0);
    const actual = dayShifts.reduce((n, s) => {
      const v = deriveShift(s, events, now);
      if (v.checkIn && v.checkOut)
        return n + (v.checkOut.getTime() - v.checkIn.getTime()) / 3600000;
      if (v.checkIn) return n + (now.getTime() - v.checkIn.getTime()) / 3600000;
      return n;
    }, 0);
    return {
      label: d.toLocaleDateString("en-AU", { weekday: "short" }),
      value: Math.round(actual * 10) / 10,
      reference: Math.round(rostered * 10) / 10,
      emphasis: key === today,
    };
  });
  const weekActual = Math.round(weekData.reduce((n, d) => n + d.value, 0) * 10) / 10;
  const weekRostered = Math.round(weekData.reduce((n, d) => n + d.reference, 0) * 10) / 10;

  const activity: { kind: keyof typeof activityDot; who: string; what: string; at: string }[] = [
    ...missed.map((m) => ({
      kind: "alert" as const,
      who: m.staff.name,
      what: `missed check-in — ${m.overdueMin} min overdue`,
      at: fmtTime(m.shift.start),
    })),
    ...events
      .filter((e) => dateKey(new Date(e.at)) === today)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 6)
      .map((e) => ({
        kind: e.kind === "in" ? ("check-in" as const) : ("check-out" as const),
        who: staffById[e.staffId]?.name ?? "Unknown",
        what: e.kind === "in" ? "checked in at the kiosk" : "checked out at the kiosk",
        at: fmtClock(new Date(e.at)),
      })),
  ].slice(0, 7);
  return (
    <>
      {/* hero row */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
        <Card className="relative overflow-hidden">
          <CardBody className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
                  Building operations ·{" "}
                  <span className="text-accent-text">Live</span>
                </p>
                <h1 className="mt-2 font-display text-display text-fg">{building.name}</h1>
                <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-fg-muted">
                  <MapPin aria-hidden className="size-4" /> Melbourne CBD · 40 levels
                </p>
              </div>
              <Link
                href="/kiosk"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-control bg-accent px-3.5 text-body-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                <ScanLine aria-hidden className="size-4" /> Kiosk links
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
                  Local time
                </p>
                <LiveClock className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <HeroStat label="On site" value={onSite} tone="accent" />
                <HeroStat label="Open tasks" value={2} />
                <HeroStat label="Late" value={late} tone={late ? "warning" : undefined} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
                  Weather{weather.live && <span className="text-accent-text"> · live</span>}
                </p>
                <p className="mt-1 text-body-sm font-medium text-fg">{weather.city}</p>
              </div>
              <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                <Wind aria-hidden className="size-3.5" /> {weather.windKmh} km/h
              </p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <p className="font-numeric text-display text-fg tabular-nums">{weather.tempC}°</p>
              <div className="text-body-sm text-fg-muted">
                <p>{weather.condition}</p>
                <p>Feels like {weather.feelsLikeC}°</p>
              </div>
            </div>
            <div className="mt-auto flex justify-between gap-1 pt-5">
              {weather.hourly.map((h) => (
                <div key={h.at} className="flex flex-col items-center gap-1 text-caption text-fg-muted">
                  <span className="uppercase">{h.at}</span>
                  {h.kind === "rain" ? (
                    <CloudRain aria-hidden className="size-4 text-info" />
                  ) : (
                    <Cloud aria-hidden className="size-4 text-fg-muted" />
                  )}
                  <span className="font-medium text-fg tabular-nums">{h.tempC}°</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex h-full flex-col">
            <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
              Cleaning progress
            </p>
            <p className="mt-1 text-body-sm font-medium text-fg">Today · all zones</p>
            <div className="mt-4 flex flex-1 items-center gap-6">
              <div
                role="meter"
                aria-label="Zones cleaned"
                aria-valuenow={cleanedPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative size-28 shrink-0 rounded-pill"
              >
                {/* True ring: centre is masked out, so translucent card surfaces
                    (glass variant) show through instead of a painted hole. */}
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-pill"
                  style={{
                    background: `conic-gradient(var(--chart-1) 0 ${(zoneProgress.complete / zonesTotal) * 100}%, var(--chart-2) ${(zoneProgress.complete / zonesTotal) * 100}% ${((zoneProgress.complete + zoneProgress.inProgress) / zonesTotal) * 100}%, var(--chart-3) ${((zoneProgress.complete + zoneProgress.inProgress) / zonesTotal) * 100}% 100%)`,
                    WebkitMaskImage: "radial-gradient(closest-side, transparent 77%, var(--accent) 78%)",
                    maskImage: "radial-gradient(closest-side, transparent 77%, var(--accent) 78%)",
                  }}
                />
                <span className="absolute inset-3 flex flex-col items-center justify-center rounded-pill">
                  <span className="font-numeric text-title-1 text-fg tabular-nums">{cleanedPct}%</span>
                  <span className="text-caption tracking-[0.06em] text-fg-muted uppercase">cleaned</span>
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 text-body-sm">
                <li className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill bg-chart-1" />
                  <span className="text-fg-secondary">Complete</span>
                  <span className="ml-auto font-mono text-fg">{zoneProgress.complete}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill bg-chart-2" />
                  <span className="text-fg-secondary">In progress</span>
                  <span className="ml-auto font-mono text-fg">{zoneProgress.inProgress}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill bg-edge-strong" />
                  <span className="text-fg-secondary">Pending</span>
                  <span className="ml-auto font-mono text-fg">{zoneProgress.pending}</span>
                </li>
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* stat row */}
      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Shifts today" value={views.length} context={`${onSite} in progress · ${done} done`} />
        <MetricCard label="Check-ins" value={checkInsToday} context="Kiosk events today" />
        <MetricCard
          label="Missed check-ins"
          value={missed.length}
          context={
            missed.length
              ? `${missed.map((m) => m.staff.name.split(" ")[0]).join(", ")} · alert raised`
              : "All shifts covered"
          }
          tone={missed.length ? "critical" : "neutral"}
        />
        <MetricCard label="Cleaning progress" value={`${cleanedPct}%`} context={`${zoneProgress.complete}/${zonesTotal} zones done`} tone="success" />
      </div>

      {/* camera wall — locked module, polished */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Live camera wall</CardTitle>
            <p className="mt-1 text-body-sm text-fg-muted">
              Presence verification from building cameras, tied to zones and shifts.
            </p>
          </div>
          <Badge tone="info">Requires Automation Pro</Badge>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cameraZones.map((c) => (
            <div
              key={c.name}
              className="relative flex aspect-video flex-col justify-between rounded-card bg-accent p-4 text-on-accent"
            >
              <div className="flex items-center justify-between text-caption opacity-70">
                <span className="flex items-center gap-1.5">
                  <Camera aria-hidden className="size-3.5" /> Preview
                </span>
                <Lock aria-hidden className="size-3.5" />
              </div>
              <div>
                <p className="text-body-sm font-medium">{c.name}</p>
                <p className="text-caption tracking-[0.06em] uppercase opacity-70">{c.where}</p>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* shifts + activity */}
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <SectionHeader
            title="Today’s shifts"
            actions={
              <Button variant="ghost" size="sm">
                Open roster <ArrowRight aria-hidden />
              </Button>
            }
          />
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner</Th>
                <Th>Zone</Th>
                <Th numeric>Scheduled</Th>
                <Th numeric>Check-in</Th>
                <Th numeric>Check-out</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {views.map((v) => {
                const meta = shiftStatusMeta[v.status];
                return (
                  <Tr key={v.shift.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={v.staff.name} size="sm" />
                        <span className="font-medium">{v.staff.name}</span>
                      </span>
                    </Td>
                    <Td className="text-fg-secondary">{v.shift.zone}</Td>
                    <Td numeric>
                      {fmtTime(v.shift.start)}–{fmtTime(v.shift.end)}
                    </Td>
                    <Td numeric>{v.checkIn ? fmtClock(v.checkIn) : "—"}</Td>
                    <Td numeric>{v.checkOut ? fmtClock(v.checkOut) : "—"}</Td>
                    <Td>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>

        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle>Live activity</CardTitle>
            <StatusPill tone="accent">Streaming</StatusPill>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {activity.map((e, i) => (
              <div key={i} className="flex items-start gap-3">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-pill", activityDot[e.kind])} />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-fg">
                    <span className="font-medium">{e.who}</span>{" "}
                    <span className="text-fg-secondary">— {e.what}</span>
                  </p>
                </div>
                <p className="shrink-0 font-mono text-caption text-fg-muted">{e.at}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* due this week + handover */}
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Due at the building</CardTitle>
              <p className="mt-1 text-body-sm text-fg-muted">
                From the shared calendar — periodic works, contractors, bookings
              </p>
            </div>
            <Link href="/calendar" className="flex items-center gap-1 text-body-sm font-medium text-accent-text">
              Calendar <ArrowRight aria-hidden className="size-4" />
            </Link>
          </CardHeader>
          <CardBody className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
                Today · {dueToday.length}
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                {dueToday.length === 0 && (
                  <p className="text-body-sm text-fg-muted">Nothing due today.</p>
                )}
                {dueToday.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5">
                    <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-pill",
                      e.category === "periodic" ? "bg-critical" : e.category === "contractor" ? "bg-warning" : e.category === "waste" ? "bg-success" : "bg-info")} />
                    <div className="min-w-0">
                      <p className="truncate text-body-sm text-fg">{e.title}</p>
                      <p className="text-caption text-fg-muted">{calCategoryMeta[e.category].label}</p>
                    </div>
                  </div>
                ))}
                {dueToday.length > 5 && (
                  <p className="text-caption text-fg-muted">+{dueToday.length - 5} more on the calendar</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
                Next 7 days · {dueLater.length}
              </p>
              <div className="mt-3 flex flex-col gap-2.5">
                {dueLater.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-9 shrink-0 font-mono text-caption text-fg-muted">
                      {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short" })}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm text-fg">{e.title}</p>
                      <p className="text-caption text-fg-muted">{calCategoryMeta[e.category].label}</p>
                    </div>
                  </div>
                ))}
                {dueLater.length > 5 && (
                  <p className="text-caption text-fg-muted">+{dueLater.length - 5} more on the calendar</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="min-w-0 self-start">
          <CardHeader>
            <CardTitle>Team handover</CardTitle>
            <Badge tone="neutral">FOCT Cleaning only</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <Input
                placeholder="Note for the next shift…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!noteText.trim()}
                onClick={() => {
                  addNote("Priya Sharma", noteText.trim());
                  setNoteText("");
                  toast({ tone: "success", title: "Handover note saved" });
                }}
              >
                Save
              </Button>
            </div>
            {notes.slice(0, 3).map((n, i) => (
              <div key={n.id} className={cn("flex items-start gap-3", i > 0 && "border-t border-edge pt-4")}>
                <Avatar name={n.author} size="sm" />
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-fg">{n.author}</p>
                  <p className="mt-0.5 text-body-sm text-fg-secondary">{n.text}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* hours + supplies */}
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Hours this week</CardTitle>
              <p className="mt-1 text-body-sm text-fg-muted">Actual vs rostered · week of {monday.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}</p>
            </div>
            <p className="font-numeric text-title-2 text-fg tabular-nums">
              {weekActual.toFixed(1)}
              <span className="text-body-sm font-normal text-fg-muted"> / {weekRostered.toFixed(1)} h</span>
            </p>
          </CardHeader>
          <CardBody>
            <MiniBarChart
              data={weekData}
              format={(v) => `${v} h`}
              seriesLabel="Actual hours"
              referenceLabel="Rostered"
            />
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Service desk</CardTitle>
              <Link href="/service-desk" className="flex items-center gap-1 text-body-sm font-medium text-accent-text">
                Queue <ArrowRight aria-hidden className="size-4" />
              </Link>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              {sdByStatus.map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-20 text-body-sm text-fg-secondary">{r.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-hover">
                    <span className="block h-full rounded-pill bg-chart-1" style={{ width: `${(r.count / sdMax) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right font-numeric text-body-sm text-fg tabular-nums">{r.count}</span>
                </div>
              ))}
              <p className="mt-1 text-caption text-fg-muted">
                {sdUrgentOpen ? `${sdUrgentOpen} urgent open — attend first` : "No urgent tickets open"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
              <Button variant="ghost" size="sm">
                <Package aria-hidden /> Order
              </Button>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {lowStock.map((item) => (
                <div key={item.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-body-sm font-medium text-fg">{item.name}</p>
                    <p className="shrink-0 font-mono text-caption text-fg-muted">{item.onHand} left</p>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${item.name} stock level`}
                    aria-valuenow={Math.round(item.level * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-2 h-1.5 overflow-hidden rounded-pill bg-hover"
                  >
                    <div className="h-full rounded-pill bg-critical" style={{ width: `${item.level * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site audit score</CardTitle>
              <StatusPill tone="success">On target</StatusPill>
            </CardHeader>
            <CardBody>
              <p className="font-numeric text-display text-fg tabular-nums">96%</p>
              <p className="mt-1 text-body-sm text-fg-muted">
                Last audit 28 June · two follow-up photos requested
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-warning-subtle">
                <Flag aria-hidden className="size-4 text-warning-text" />
              </span>
              <div>
                <p className="text-body-sm font-medium text-fg">Graffiti at the loading dock</p>
                <p className="mt-0.5 text-body-sm text-fg-muted">
                  Flagged by Daniel with a photo, 08:40. May need a contractor.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
