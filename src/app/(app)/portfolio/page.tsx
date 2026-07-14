"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowDownRight, ArrowUpRight, Minus, Building2 } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import {
  dateKey,
  deriveMissedAlerts,
  deriveShift,
  useAttendanceReady,
  useAttendanceStore,
} from "@/lib/attendance-store";
import { useSdRehydrate, useSdStore } from "@/lib/service-desk-store";
import {
  portfolioSeed,
  ragFor,
  ragMeta,
  type PortfolioBuilding,
} from "@/lib/portfolio-data";
import { cn } from "@/lib/cn";

/**
 * Portfolio — the head-office command centre. Exception-first: buildings
 * needing attention rank first as tiles, healthy ones collapse to rows.
 * Aurora on Collins is LIVE (attendance + service-desk stores feed its
 * signals); sister buildings are seeded until multi-building data lands.
 */

function Trend({ dir }: { dir: "up" | "down" | "flat" }) {
  if (dir === "up") return <ArrowUpRight aria-label="improving" className="size-3.5 text-success-text" />;
  if (dir === "down") return <ArrowDownRight aria-label="declining" className="size-3.5 text-critical-text" />;
  return <Minus aria-label="steady" className="size-3.5 text-fg-muted" />;
}

function Signal({
  label,
  value,
  alarm,
  trend,
}: {
  label: string;
  value: string | number;
  alarm?: boolean;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div>
      <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1 font-numeric text-title-2 tabular-nums",
          alarm ? "text-critical-text" : "text-fg"
        )}
      >
        {value}
        {trend && <Trend dir={trend} />}
      </p>
    </div>
  );
}

function BuildingTile({ b }: { b: PortfolioBuilding }) {
  const { toast } = useToast();
  const rag = ragFor(b.signals);
  const meta = ragMeta[rag];
  const s = b.signals;

  const why: string[] = [];
  if (s.missedNow) why.push(`${s.missedNow} missed check-in${s.missedNow > 1 ? "s" : ""} right now`);
  if (s.slaBreachesToday) why.push(`${s.slaBreachesToday} SLA breach${s.slaBreachesToday > 1 ? "es" : ""} today`);
  if (s.openUrgentTickets) why.push(`${s.openUrgentTickets} urgent ticket${s.openUrgentTickets > 1 ? "s" : ""} open`);
  if (s.auditScore < 90) why.push(`audit slipped to ${s.auditScore}%`);
  if (Math.abs(s.hoursVsContractPct - 100) > 5)
    why.push(`labour ${s.hoursVsContractPct > 100 ? "over" : "under"} contract (${s.hoursVsContractPct}%)`);

  const inner = (
    <Card
      className={cn(
        "h-full transition-shadow hover:shadow-raised",
        rag === "critical" && "border-l-4 border-l-critical",
        rag === "warning" && "border-l-4 border-l-warning"
      )}
    >
      <CardBody className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-title-2 text-fg">{b.name}</p>
            <p className="mt-0.5 text-body-sm text-fg-muted">
              {b.suburb} · {b.levels} levels · <span className="font-mono">{b.code}</span>
              {b.live && <span className="text-accent-text"> · live</span>}
            </p>
          </div>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>
        {why.length > 0 && (
          <p className="mt-3 text-body-sm text-fg-secondary">{why.join(" · ")}</p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-edge pt-4 sm:grid-cols-5">
          <Signal label="Missed now" value={s.missedNow} alarm={s.missedNow > 0} />
          <Signal label="SLA today" value={s.slaBreachesToday} alarm={s.slaBreachesToday > 0} />
          <Signal label="Urgent" value={s.openUrgentTickets} alarm={s.openUrgentTickets > 0} />
          <Signal label="Audit" value={`${s.auditScore}%`} trend={s.auditTrend} />
          <Signal label="Hours" value={`${s.hoursVsContractPct}%`} />
        </div>
        <p className="mt-auto flex items-center gap-1 pt-4 text-body-sm font-medium text-accent-text">
          {b.live ? "Open building dashboard" : "Open building"} <ArrowRight aria-hidden className="size-4" />
        </p>
      </CardBody>
    </Card>
  );

  if (b.live) {
    return (
      <Link href="/dashboard" className="block h-full min-w-0">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="block h-full min-w-0 text-left"
      onClick={() =>
        toast({
          tone: "neutral",
          title: `${b.name} is a seeded demo building`,
          description: "Aurora on Collins is the live one — its tile opens the real dashboard.",
        })
      }
    >
      {inner}
    </button>
  );
}

export default function PortfolioPage() {
  const now = useAttendanceReady();
  useSdRehydrate();
  const shifts = useAttendanceStore((s) => s.shifts);
  const events = useAttendanceStore((s) => s.events);
  const tickets = useSdStore((s) => s.tickets);

  if (!now) return null;

  // Aurora — live signals from the real stores
  const today = dateKey(now);
  const views = shifts.filter((s) => s.date === today).map((s) => deriveShift(s, events, now));
  const missedNow = deriveMissedAlerts(shifts, events, now).length;
  const onSite = views.filter((v) => v.status === "on-site" || v.status === "late").length;
  const openStatuses = new Set(["new", "open", "in-progress", "reopened"]);
  const openTickets = tickets.filter((t) => openStatuses.has(t.status));
  const aurora: PortfolioBuilding = {
    code: "AUR",
    name: "Aurora on Collins",
    suburb: "Melbourne CBD",
    levels: 40,
    contractHoursWk: 393,
    live: true,
    signals: {
      missedNow,
      slaBreachesToday: 0,
      openUrgentTickets: openTickets.filter((t) => t.priority === "urgent").length,
      openTickets: openTickets.length,
      auditScore: 96,
      auditTrend: "up",
      hoursVsContractPct: Math.round(
        (views.filter((v) => v.status !== "missed").length / Math.max(1, views.length)) * 100
      ),
      cleanersOnSite: onSite,
    },
  };

  const fleet = [aurora, ...portfolioSeed];
  const attention = fleet.filter((b) => ragFor(b.signals) !== "ok");
  const healthy = fleet.filter((b) => ragFor(b.signals) === "ok");

  const totMissed = fleet.reduce((n, b) => n + b.signals.missedNow, 0);
  const totUrgent = fleet.reduce((n, b) => n + b.signals.openUrgentTickets, 0);
  const totOnSite = fleet.reduce((n, b) => n + b.signals.cleanersOnSite, 0);
  const avgAudit = Math.round(fleet.reduce((n, b) => n + b.signals.auditScore, 0) / fleet.length);

  return (
    <>
      <PageHeader
        eyebrow="Head office · FOCT Cleaning"
        title="Portfolio"
        description={`${fleet.length} buildings under management — exceptions first, healthy sites collapse below.`}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Needs attention"
          value={attention.length}
          context={`of ${fleet.length} buildings`}
          tone={attention.length ? "critical" : "success"}
        />
        <MetricCard
          label="Missed check-ins now"
          value={totMissed}
          context="across the portfolio"
          tone={totMissed ? "critical" : "neutral"}
        />
        <MetricCard
          label="Urgent tickets open"
          value={totUrgent}
          context="all buildings"
          tone={totUrgent ? "warning" : "neutral"}
        />
        <MetricCard label="Cleaners on site" value={totOnSite} context={`avg audit ${avgAudit}%`} />
      </div>

      {attention.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 font-display text-title-2 text-fg">Needs attention</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {attention.map((b) => (
              <BuildingTile key={b.code} b={b} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-8 mb-4 font-display text-title-2 text-fg">Healthy</h2>
      {healthy.length === 0 ? (
        <p className="text-body-sm text-fg-muted">Nothing healthy right now — busy morning.</p>
      ) : (
        <Card>
          <CardBody className="divide-y divide-edge p-0">
            {healthy.map((b) => {
              const s = b.signals;
              return (
                <div key={b.code} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
                  <span className="flex min-w-52 items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-control bg-accent-subtle">
                      <Building2 aria-hidden className="size-4 text-accent-text" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body-sm font-medium text-fg">{b.name}</span>
                      <span className="block text-caption text-fg-muted">
                        {b.suburb} · <span className="font-mono">{b.code}</span>
                      </span>
                    </span>
                  </span>
                  <span className="font-numeric text-body-sm text-fg-secondary tabular-nums">
                    {s.cleanersOnSite} on site
                  </span>
                  <span className="font-numeric text-body-sm text-fg-secondary tabular-nums">
                    {s.openTickets} tickets
                  </span>
                  <span className="flex items-center gap-1 font-numeric text-body-sm text-fg-secondary tabular-nums">
                    audit {s.auditScore}% <Trend dir={s.auditTrend} />
                  </span>
                  <span className="font-numeric text-body-sm text-fg-secondary tabular-nums">
                    hours {s.hoursVsContractPct}%
                  </span>
                  <StatusPill tone="success" className="ml-auto">
                    Healthy
                  </StatusPill>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
    </>
  );
}
