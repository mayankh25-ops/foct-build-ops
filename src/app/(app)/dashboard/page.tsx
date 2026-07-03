import type { Metadata } from "next";
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
  liveActivity,
  shiftStatusMeta,
  stock,
  todaysShifts,
  weather,
  weekHours,
  zoneProgress,
} from "@/lib/demo-data";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Dashboard — FOCT BuildingOps" };

const lowStock = stock.filter((s) => s.level <= 0.25);
const onSite = todaysShifts.filter((s) => s.status === "on-site" || s.status === "late").length;
const late = todaysShifts.filter((s) => s.status === "late").length;
const zonesTotal = zoneProgress.complete + zoneProgress.inProgress + zoneProgress.pending;
const cleanedPct = Math.round((zoneProgress.complete / zonesTotal) * 100);

function HeroStat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warning" | "critical" }) {
  return (
    <div className="rounded-control border border-edge bg-surface px-4 py-3">
      <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-title-1 tabular-nums",
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

const activityDot: Record<(typeof liveActivity)[number]["kind"], string> = {
  "check-in": "bg-accent-text",
  "check-out": "bg-edge-strong",
  task: "bg-success",
  alert: "bg-critical",
  order: "bg-info",
};

export default function DashboardPage() {
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
                  Weather
                </p>
                <p className="mt-1 text-body-sm font-medium text-fg">{weather.city}</p>
              </div>
              <p className="flex items-center gap-1.5 text-caption text-fg-muted">
                <Wind aria-hidden className="size-3.5" /> {weather.windKmh} km/h
              </p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <p className="font-display text-display text-fg tabular-nums">{weather.tempC}°</p>
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
                style={{
                  background: `conic-gradient(var(--success) 0 ${(zoneProgress.complete / zonesTotal) * 100}%, var(--warning) ${(zoneProgress.complete / zonesTotal) * 100}% ${((zoneProgress.complete + zoneProgress.inProgress) / zonesTotal) * 100}%, var(--bg-hover) ${((zoneProgress.complete + zoneProgress.inProgress) / zonesTotal) * 100}% 100%)`,
                }}
              >
                <span className="absolute inset-3 flex flex-col items-center justify-center rounded-pill bg-surface">
                  <span className="font-display text-title-1 text-fg tabular-nums">{cleanedPct}%</span>
                  <span className="text-caption tracking-[0.06em] text-fg-muted uppercase">cleaned</span>
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 text-body-sm">
                <li className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill bg-success" />
                  <span className="text-fg-secondary">Complete</span>
                  <span className="ml-auto font-mono text-fg">{zoneProgress.complete}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden className="size-2 rounded-pill bg-warning" />
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
        <MetricCard label="Shifts today" value={todaysShifts.length} context="3 in progress · 1 done" />
        <MetricCard label="Check-ins" value={5} context="Events today" />
        <MetricCard label="Missed check-ins" value={1} context="Tom · 06:00 shift" tone="critical" />
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
              className="relative flex aspect-video flex-col justify-between rounded-control bg-accent p-4 text-on-accent"
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
              {todaysShifts.map((s) => {
                const meta = shiftStatusMeta[s.status];
                return (
                  <Tr key={s.cleaner}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={s.cleaner} size="sm" />
                        <span className="font-medium">{s.cleaner}</span>
                      </span>
                    </Td>
                    <Td className="text-fg-secondary">{s.zone}</Td>
                    <Td numeric>
                      {fmtTime(s.scheduled[0])}–{fmtTime(s.scheduled[1])}
                    </Td>
                    <Td numeric>{fmtTime(s.actual?.[0])}</Td>
                    <Td numeric>{fmtTime(s.actual?.[1])}</Td>
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
            {liveActivity.map((e, i) => (
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

      {/* hours + supplies */}
      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Hours this week</CardTitle>
              <p className="mt-1 text-body-sm text-fg-muted">Actual vs rostered · week of 30 June</p>
            </div>
            <p className="font-display text-title-2 text-fg tabular-nums">
              57.9<span className="text-body-sm font-normal text-fg-muted"> / 142.5 h</span>
            </p>
          </CardHeader>
          <CardBody>
            <MiniBarChart
              data={weekHours.map((d) => ({
                label: d.day,
                value: d.actual,
                reference: d.rostered,
                emphasis: d.today,
              }))}
              format={(v) => `${v} h`}
              seriesLabel="Actual hours"
              referenceLabel="Rostered"
            />
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
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
              <p className="font-display text-display text-fg tabular-nums">96%</p>
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
