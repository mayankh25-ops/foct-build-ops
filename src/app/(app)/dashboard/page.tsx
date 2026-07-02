import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Clock,
  Flag,
  MapPin,
  Package,
  Plus,
  Users,
} from "lucide-react";
import { AttendanceTimeline } from "@/components/ui/attendance-timeline";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  building,
  fmtTime,
  recentTasks,
  shiftStatusMeta,
  stock,
  todaysShifts,
} from "@/lib/demo-data";

export const metadata: Metadata = { title: "Dashboard — FOCT CleaningOps" };

const lowStock = stock.filter((s) => s.level <= 0.25);

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Good morning, Priya"
        description={`${building.name} · Wednesday 2 July · 6 cleaners rostered today`}
        actions={
          <>
            <Button variant="secondary">
              <CalendarDays aria-hidden /> Today, 2 July
            </Button>
            <Button>
              <Plus aria-hidden /> Add shift
            </Button>
          </>
        }
      />

      {/* Today at a glance */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Expected today" value="6" context="Across 6 zones" icon={Users} />
        <MetricCard label="On site now" value="3" context="Since 05:58" icon={MapPin} tone="accent" />
        <MetricCard label="Started late" value="1" context="Sofia · 25 min" icon={Clock} tone="warning" />
        <MetricCard label="Missed check-ins" value="1" context="Tom · 06:00 shift" icon={AlertTriangle} tone="critical" />
        <MetricCard label="Timesheets to review" value="4" context="Week ending 28 June" icon={ClipboardCheck} />
        <MetricCard label="Consumable requests" value="2" context={`${lowStock.length} items low on stock`} icon={Package} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        {/* left / main column */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Live attendance</CardTitle>
                <p className="mt-1 text-body-sm text-fg-muted">
                  Scheduled window vs actual presence · updates as cleaners check in
                </p>
              </div>
              <StatusPill tone="accent">3 on site</StatusPill>
            </CardHeader>
            <CardBody>
              <AttendanceTimeline
                now={9.25}
                rows={todaysShifts
                  .filter((s) => s.status !== "rostered")
                  .map((s) => ({
                    name: s.cleaner,
                    zone: s.zone,
                    scheduled: s.scheduled,
                    actual: s.actual,
                    status: s.status as "completed" | "on-site" | "late" | "missed",
                  }))}
              />
            </CardBody>
          </Card>

          <div>
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
                      <Td className="font-medium">{s.cleaner}</Td>
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
        </div>

        {/* right column */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Needs attention</CardTitle>
              <Badge tone="critical">2</Badge>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-critical-subtle">
                  <AlertTriangle aria-hidden className="size-4 text-critical-text" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-fg">Tom Nguyen missed the 06:00 check-in</p>
                  <p className="mt-0.5 text-body-sm text-fg-muted">
                    L25–L40 + BOH is uncovered. Alert sent 06:15.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-3">
                    Reassign zone
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-3 border-t border-edge pt-5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-warning-subtle">
                  <Flag aria-hidden className="size-4 text-warning-text" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-fg">Graffiti reported at the loading dock</p>
                  <p className="mt-0.5 text-body-sm text-fg-muted">
                    Flagged by Daniel with photo, 08:40. May need a contractor.
                  </p>
                  <Button size="sm" variant="secondary" className="mt-3">
                    Review task
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Low stock</CardTitle>
              <Button variant="ghost" size="sm">
                Order <ArrowRight aria-hidden />
              </Button>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {lowStock.map((item) => (
                <div key={item.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-body-sm font-medium text-fg">{item.name}</p>
                    <p className="shrink-0 font-mono text-caption text-fg-muted">
                      {item.onHand} left
                    </p>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${item.name} stock level`}
                    aria-valuenow={Math.round(item.level * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-2 h-1.5 overflow-hidden rounded-pill bg-hover"
                  >
                    <div
                      className="h-full rounded-pill bg-critical"
                      style={{ width: `${item.level * 100}%` }}
                    />
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
              <p className="font-mono text-display text-fg">96%</p>
              <p className="mt-1 text-body-sm text-fg-muted">
                Last audit 28 June · two follow-up photos requested
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent cleaning tasks</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {recentTasks.map((t) => (
                <div key={t.title} className="flex items-center gap-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-control ${
                      t.status === "flagged"
                        ? "bg-warning-subtle text-warning-text"
                        : "bg-success-subtle text-success-text"
                    }`}
                  >
                    <Camera aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-fg">{t.title}</p>
                    <p className="text-caption text-fg-muted">
                      {t.by} · {t.zone} · <span className="font-mono">{t.when}</span> · {t.photos}{" "}
                      photo{t.photos > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
