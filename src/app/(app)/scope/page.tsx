"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Design's card-h: title row with a hairline divider and a right-hand meta slot. */
function CardHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
      <h3 className="text-title-3 text-fg">{title}</h3>
      {actions}
    </div>
  );
}
import {
  SCOPE_SEED,
  type ScopeEntity,
  type ScopePosition,
  type ScopeShift,
} from "@/lib/scope-data";
import "./scope.css";

/*
 * Scope — contract-scope explorer for the cleaning agreement. Ported from
 * the owner's "Aurora Scope Explorer — Subzero" standalone (2026-07-10):
 * five views over the agreement read — Overview, Scope explorer, Weekly
 * roster, Day gantt, Periodic planner. All colour comes from theme tokens.
 */

const FQCLASS: Record<string, string> = {
  "3x Daily": "sc-fq-3d",
  "2x Daily": "sc-fq-2d",
  Daily: "sc-fq-d",
  "Check Daily": "sc-fq-cd",
  "3 days/week": "sc-fq-3w",
  Weekly: "sc-fq-w",
  Monthly: "sc-fq-m",
  Quarterly: "sc-fq-q",
  "Bi-Annually": "sc-fq-ba",
  Annually: "sc-fq-a",
  "As Required": "sc-fq-ar",
};
const FREQ_ORDER = [
  "3x Daily",
  "2x Daily",
  "Daily",
  "Check Daily",
  "3 days/week",
  "Weekly",
  "Monthly",
  "Quarterly",
  "Bi-Annually",
  "Annually",
  "As Required",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const fmt1 = (n: number) =>
  (Math.round(n * 10) / 10).toLocaleString("en-AU", { minimumFractionDigits: 1 });
const h2t = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};
const countItems = (oc: ScopeEntity) => oc.zones.reduce((n, z) => n + z.tasks.length, 0);

const seed = SCOPE_SEED;
const active = seed.ocs.filter((o) => o.included);
const optional = seed.ocs.filter((o) => !o.included);
const totItems = active.reduce((n, o) => n + countItems(o), 0);
const optItems = optional.reduce((n, o) => n + countItems(o), 0);
const totHours = seed.ocs.reduce((n, o) => n + (o.included ? o.weeklyHours : 0), 0);
const byId = Object.fromEntries(seed.ocs.map((o) => [o.id, o]));
const positions = seed.positions;
const wkDay = positions.reduce((n, p) => n + (p.wk ? p.wk.h : 0), 0);
const weDay = positions.reduce((n, p) => n + (p.we ? p.we.h : 0), 0);

function FqChip({ f }: { f: string }) {
  return <span className={`sc-fq ${FQCLASS[f] ?? "sc-fq-ar"}`}>{f}</span>;
}

function PhBadge({ t }: { t: string }) {
  const s = t.toLowerCase();
  if (s.startsWith("excluded")) return <span className="sc-badge sc-badge-red">PH EXCLUDED</span>;
  if (s.startsWith("not stated"))
    return <span className="sc-badge sc-badge-amber">PH UNSTATED</span>;
  return <span className="sc-badge sc-badge-green">PH INCLUDED</span>;
}

const TbaBadge = () => (
  <span
    className="sc-badge sc-badge-amber"
    title="Contract: all start/finish times are 'to be advised'"
  >
    ⏲ TIMES TBA
  </span>
);

/* ---------------- overview ---------------- */

function HBar({
  label,
  code,
  chip,
  pct,
  value,
  optionalBar,
}: {
  label?: string;
  code?: string;
  chip?: React.ReactNode;
  pct: number;
  value: string;
  optionalBar?: boolean;
}) {
  return (
    <div className="sc-hbar-row">
      <span className="sc-lbl">
        {chip ?? (
          <>
            <span className="sc-code">{code}</span>
            <b>{label}</b>
          </>
        )}
      </span>
      <div className="sc-hbar-track">
        <div
          className={`sc-hbar-fill${optionalBar ? " sc-opt" : ""}`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <span className="sc-val">{value}</span>
    </div>
  );
}

function OverviewView() {
  const maxH = Math.max(...seed.ocs.map((o) => o.weeklyHours));
  const fqCounts: Record<string, number> = {};
  active.forEach((o) =>
    o.zones.forEach((z) =>
      z.tasks.forEach((t) => {
        fqCounts[t.f] = (fqCounts[t.f] ?? 0) + 1;
      })
    )
  );
  const maxC = Math.max(...Object.values(fqCounts));
  const sec = seed.security;
  const gate = seed.gateService;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where the hours go"
            actions={<span className="sc-eyebrow">{fmt1(totHours)} h/wk contracted</span>}
          />
          <CardBody>
            {seed.ocs.map((o) => (
              <HBar
                key={o.id}
                code={o.id}
                label={o.name}
                pct={(o.weeklyHours / maxH) * 100}
                value={`${fmt1(o.weeklyHours)} h/wk${o.included ? "" : " · OPT"}`}
                optionalBar={!o.included}
              />
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Scope mix by frequency"
            actions={<span className="sc-eyebrow">{totItems} active items</span>}
          />
          <CardBody>
            {FREQ_ORDER.filter((f) => fqCounts[f]).map((f) => (
              <HBar
                key={f}
                chip={<FqChip f={f} />}
                pct={((fqCounts[f] ?? 0) / maxC) * 100}
                value={`${fqCounts[f]} items`}
              />
            ))}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader
          title="Contract watch-list"
          actions={
            <span className="sc-eyebrow">{seed.flags.length} flags from the agreement read</span>
          }
        />
        <CardBody>
          {seed.flags.map((f, i) => (
            <div key={i} className="sc-flag-row">
              <AlertTriangle size={15} className="text-warning" />
              <span>{f}</span>
            </div>
          ))}
        </CardBody>
      </Card>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Night security"
            actions={<span className="sc-badge sc-badge-amber">HOURS TBD</span>}
          />
          <CardBody>
            <div className="sc-meta-grid">
              <div>
                <div className="sc-lb">Position</div>
                <div className="sc-vv">
                  {sec.code} · {sec.role}
                </div>
              </div>
              <div>
                <div className="sc-lb">Shift</div>
                <div className="sc-vv sc-mono">{sec.shift}</div>
              </div>
              <div>
                <div className="sc-lb">Days</div>
                <div className="sc-vv">{sec.days}</div>
              </div>
              <div>
                <div className="sc-lb">Weekly hours</div>
                <div className="sc-vv sc-mono">{fmt1(sec.weeklyHours)}</div>
              </div>
            </div>
            <p className="mt-3 text-body-sm text-fg-muted">
              {sec.uniform}. {sec.status}.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Gate & door PM" actions={<FqChip f={gate.frequency} />} />
          <CardBody>
            <p className="mb-3 text-body-sm text-fg-muted">
              {gate.name} — commences {gate.commencement.toLowerCase()}.
            </p>
            <div className="sc-eyebrow mb-2">Assets</div>
            <ul className="sc-plain">
              {gate.assets.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <div className="sc-eyebrow mt-3 mb-2">Each visit</div>
            <ul className="sc-plain">
              {gate.tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="The agreement" actions={<span className="sc-eyebrow">source</span>} />
          <CardBody>
            <div className="sc-src-row">
              <span className="sc-fn">{seed.contract.building}</span>
              <span className="sc-ds">contract data — entities, zones, tasks, roster, flags</span>
            </div>
            <div className="sc-src-row">
              <span className="sc-fn">{seed.contract.dated}</span>
              <span className="sc-ds">agreement date</span>
            </div>
            <p className="mt-3 text-body-sm text-fg-muted">
              {seed.contract.title}, dated {seed.contract.dated}. {seed.contract.note}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- scope explorer ---------------- */

function ScopeView() {
  const [selEntity, setSelEntity] = React.useState(active[0]?.id ?? "OC1");
  const [selFreq, setSelFreq] = React.useState<string | null>(null);

  const oc = byId[selEntity] ?? active[0]!;
  const counts: Record<string, number> = {};
  oc.zones.forEach((z) =>
    z.tasks.forEach((t) => {
      counts[t.f] = (counts[t.f] ?? 0) + 1;
    })
  );
  const freq = selFreq && counts[selFreq] ? selFreq : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="sc-pills" role="tablist" aria-label="Contract entity">
        {seed.ocs.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            className={`sc-pill${o.included ? "" : " sc-optional"}`}
            aria-selected={o.id === selEntity}
            onClick={() => {
              setSelEntity(o.id);
              setSelFreq(null);
            }}
          >
            <span className="sc-code">{o.id}</span>
            <span>{o.name}</span>
            <span className="sc-n">
              {fmt1(o.weeklyHours)}h · {countItems(o)}
            </span>
          </button>
        ))}
      </div>
      {!oc.included && (
        <div className="sc-banner">
          Optional extra — not included in this agreement · standing upsell (
          {fmt1(oc.weeklyHours)} h/week)
        </div>
      )}
      <Card>
        <CardBody>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-title-1 text-fg">
              {oc.id} — {oc.name}
            </h2>
            <PhBadge t={oc.publicHolidays} />
          </div>
          <p className="mb-4 text-body-sm text-fg-muted">{oc.sub}</p>
          <div className="sc-meta-grid">
            <div>
              <div className="sc-lb">Service days</div>
              <div className="sc-vv">{oc.days}</div>
            </div>
            <div>
              <div className="sc-lb">Public holidays</div>
              <div className="sc-vv">{oc.publicHolidays}</div>
            </div>
            <div>
              <div className="sc-lb">Crew</div>
              <div className="sc-vv">{oc.crew}</div>
            </div>
            <div>
              <div className="sc-lb">Weekly hours</div>
              <div className="sc-vv sc-mono">{fmt1(oc.weeklyHours)}</div>
            </div>
            <div>
              <div className="sc-lb">Operating days / yr</div>
              <div className="sc-vv sc-mono">{oc.opDaysPerYear}</div>
            </div>
          </div>
        </CardBody>
      </Card>
      <div className="sc-fchips">
        <button
          type="button"
          className="sc-fchip"
          aria-pressed={!freq}
          onClick={() => setSelFreq(null)}
        >
          All <span className="sc-cnt">{countItems(oc)}</span>
        </button>
        {FREQ_ORDER.filter((f) => counts[f]).map((f) => (
          <button
            key={f}
            type="button"
            className="sc-fchip"
            aria-pressed={freq === f}
            onClick={() => setSelFreq(f)}
          >
            <span className={`sc-swatch sc-fq ${FQCLASS[f]}`} style={{ padding: 0 }} />
            {f} <span className="sc-cnt">{counts[f]}</span>
          </button>
        ))}
      </div>
      <div className="sc-zones">
        {oc.zones.map((z) => {
          const tasks = z.tasks.filter((t) => !freq || t.f === freq);
          if (!tasks.length) return null;
          return (
            <Card key={z.name}>
              <CardHeader
                title={z.name}
                actions={
                  <span className="sc-eyebrow">
                    {tasks.length}
                    {freq ? ` of ${z.tasks.length}` : ""} tasks
                  </span>
                }
              />
              <CardBody>
                {tasks.map((t, i) => (
                  <div key={i} className="sc-task">
                    <span className="sc-tt">{t.t}</span>
                    <FqChip f={t.f} />
                  </div>
                ))}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- weekly roster ---------------- */

function shiftLabel(s: ScopeShift | null) {
  return s ? `${h2t(s.s)}–${h2t(s.e)} (${fmt1(s.h)} h)` : "No shift";
}

function RosterView() {
  const [openRow, setOpenRow] = React.useState<number | null>(null);
  const dayTotals = DAYS.map((_, i) =>
    positions.reduce((n, p) => {
      const s = i < 5 ? p.wk : p.we;
      return n + (s ? s.h : 0);
    }, 0)
  );
  const sec = seed.security;

  return (
    <div className="flex flex-col gap-4">
      <div className="sc-banner">
        All cleaner start/finish times are &quot;to be advised&quot; — the roster below is the
        indicative proposal from the agreement
      </div>
      <Card>
        <CardHeader
          title="Positions × week"
          actions={<span className="sc-eyebrow">click a row for shift detail</span>}
        />
        <CardBody className="sc-tablewrap">
          <table className="sc-roster">
            <thead>
              <tr>
                <th>Position</th>
                {DAYS.map((d, i) => (
                  <th key={d} className={i >= 5 ? "sc-we-col" : ""}>
                    {d}
                  </th>
                ))}
                <th>Wk total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {positions.map((p, idx) => {
                const oc = byId[p.oc]!;
                const wkTot = (p.wk ? p.wk.h * 5 : 0) + (p.we ? p.we.h * 2 : 0);
                const open = openRow === idx;
                return (
                  <React.Fragment key={p.code}>
                    <tr
                      className="sc-pos-row"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenRow(open ? null : idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenRow(open ? null : idx);
                        }
                      }}
                    >
                      <td>
                        <span className="sc-pos-name">
                          <b>
                            {p.code} · {p.role}
                          </b>
                          <span>{oc.name.toUpperCase()}</span>
                        </span>
                      </td>
                      {DAYS.map((d, i) => {
                        const s = i < 5 ? p.wk : p.we;
                        return (
                          <td key={d} className={i >= 5 ? "sc-we-col" : ""}>
                            {s ? (
                              <span className="sc-hourchip">{fmt1(s.h)}</span>
                            ) : (
                              <span className="sc-hourchip sc-off">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <b className="sc-mono text-fg">{fmt1(wkTot)}</b>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <TbaBadge />
                      </td>
                    </tr>
                    {open && (
                      <tr className="sc-drawer">
                        <td colSpan={10}>
                          <div className="sc-drawer-in">
                            <div>
                              <div className="sc-lb">Weekday shift (indicative)</div>
                              <div className="sc-vv sc-mono">{shiftLabel(p.wk)}</div>
                            </div>
                            <div>
                              <div className="sc-lb">Weekend shift (indicative)</div>
                              <div className="sc-vv sc-mono">{shiftLabel(p.we)}</div>
                            </div>
                            <div>
                              <div className="sc-lb">Public holidays</div>
                              <div className="sc-vv">{oc.publicHolidays}</div>
                            </div>
                            <div>
                              <div className="sc-lb">Zones covered</div>
                              <div className="sc-vv">
                                {oc.zones.length} zones · {countItems(oc)} scope items
                              </div>
                            </div>
                            <div className="sc-drawer-note">
                              {p.note}. Start/finish contractually &quot;to be advised&quot; — this
                              roster is the indicative proposal until times are locked with {p.oc}.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="sc-tot">
                <td>Cleaning total</td>
                {dayTotals.map((t, i) => (
                  <td key={i} className={i >= 5 ? "sc-we-col" : ""}>
                    {fmt1(t)}
                  </td>
                ))}
                <td>{fmt1(totHours)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Night security — separate service"
          actions={<span className="sc-badge sc-badge-amber">SHIFT HOURS TBD</span>}
        />
        <CardBody className="sc-tablewrap">
          <table className="sc-roster">
            <tbody>
              <tr>
                <td>
                  <span className="sc-pos-name">
                    <b>
                      {sec.code} · {sec.role}
                    </b>
                    <span>WHOLE BUILDING</span>
                  </span>
                </td>
                {DAYS.map((d, i) => (
                  <td key={d} className={i >= 5 ? "sc-we-col" : ""}>
                    <span className="sc-hourchip">{fmt1(sec.hours)}</span>
                  </td>
                ))}
                <td>
                  <b className="sc-mono text-fg">{fmt1(sec.weeklyHours)}</b>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className="sc-badge sc-badge-neutral">{sec.shift}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------- day gantt ---------------- */

interface TipState {
  x: number;
  y: number;
  body: React.ReactNode;
}

function GanttView() {
  const [mode, setMode] = React.useState<"wk" | "we">("wk");
  const [tip, setTip] = React.useState<TipState | null>(null);

  const A0 = 5;
  const A1 = 20;
  const SPAN = A1 - A0;
  const hours = Array.from({ length: SPAN + 1 }, (_, i) => A0 + i).filter(
    (h) => h % 3 === 0 || h === A0
  );
  const sec = seed.security;
  const S0 = 21;
  const SSPAN = 12;
  const secHours = [21, 23, 1, 3, 5, 7, 9];

  const move = (e: React.MouseEvent, body: React.ReactNode) =>
    setTip({ x: Math.min(e.clientX + 14, window.innerWidth - 280), y: e.clientY + 16, body });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="sc-seg" role="group" aria-label="Day type">
          <button type="button" aria-pressed={mode === "wk"} onClick={() => setMode("wk")}>
            Weekday
          </button>
          <button type="button" aria-pressed={mode === "we"} onClick={() => setMode("we")}>
            Weekend
          </button>
        </div>
        <span className="sc-eyebrow">
          Dashed outline = times to be advised · hover a bar for detail
        </span>
      </div>
      <Card>
        <CardBody className="sc-tablewrap">
          <div className="sc-gantt">
            <div className="sc-g-axis">
              <div />
              <div className="sc-g-scale">
                {hours.map((h) => (
                  <span key={h} style={{ left: `${(((h - A0) / SPAN) * 100).toFixed(2)}%` }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
            </div>
            {positions.map((p) => {
              const s = mode === "wk" ? p.wk : p.we;
              const oc = byId[p.oc]!;
              return (
                <div key={p.code} className="sc-g-row">
                  <div className="sc-g-name">
                    <b>{p.code}</b>
                    <span>{oc.name.toUpperCase()}</span>
                  </div>
                  <div className="sc-g-lane">
                    {s ? (
                      <div
                        className="sc-g-bar sc-tba"
                        style={{
                          left: `${(((s.s - A0) / SPAN) * 100).toFixed(2)}%`,
                          width: `${(((s.e - s.s) / SPAN) * 100).toFixed(2)}%`,
                        }}
                        onMouseEnter={(e) =>
                          move(
                            e,
                            <>
                              <b>
                                {p.code} · {oc.name}
                              </b>
                              <br />
                              {h2t(s.s)}–{h2t(s.e)} · <b>{fmt1(s.h)} h contracted</b> over a{" "}
                              {fmt1(s.e - s.s)} h span
                              {s.e - s.s - s.h > 0
                                ? ` (${Math.round((s.e - s.s - s.h) * 60)} min unpaid break)`
                                : ""}
                              <br />
                              <span className="sc-mono">TIMES TBA — INDICATIVE PROPOSAL</span>
                              <br />
                              {p.note}
                            </>
                          )
                        }
                        onMouseMove={(e) => tip && move(e, tip.body)}
                        onMouseLeave={() => setTip(null)}
                      >
                        <span>
                          {h2t(s.s)}–{h2t(s.e)}
                        </span>
                      </div>
                    ) : (
                      <span className="sc-g-off">
                        NOT ROSTERED {mode === "wk" ? "MON–FRI" : "SAT–SUN"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="sc-g-band">Night services — 21:00 → 09:00 axis</div>
            <div className="sc-g-axis">
              <div />
              <div className="sc-g-scale">
                {secHours.map((h, i) => (
                  <span key={h} style={{ left: `${(((i * 2) / SSPAN) * 100).toFixed(2)}%` }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
            </div>
            <div className="sc-g-row">
              <div className="sc-g-name">
                <b>{sec.code}</b>
                <span>SECURITY · 7 NIGHTS</span>
              </div>
              <div className="sc-g-lane sc-h12">
                <div
                  className="sc-g-bar sc-sec sc-tba"
                  style={{
                    left: `${(((23 - S0) / SSPAN) * 100).toFixed(2)}%`,
                    width: `${((8 / SSPAN) * 100).toFixed(2)}%`,
                  }}
                  onMouseEnter={(e) =>
                    move(
                      e,
                      <>
                        <b>
                          {sec.code} · {sec.role}
                        </b>
                        <br />
                        {sec.shift} · {fmt1(sec.hours)} h nightly, 7 nights
                        <br />
                        <span className="sc-mono">{sec.status.toUpperCase()}</span>
                      </>
                    )
                  }
                  onMouseMove={(e) => tip && move(e, tip.body)}
                  onMouseLeave={() => setTip(null)}
                >
                  <span>{sec.shift}</span>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
      {tip && (
        <div className="sc-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.body}
        </div>
      )}
    </div>
  );
}

/* ---------------- periodic planner ---------------- */

function PeriodicView({ now }: { now: Date }) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const months = Array.from(
    { length: 12 },
    (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1)
  );
  const mLbl = (d: Date) => d.toLocaleDateString("en-AU", { month: "short" }).toUpperCase();
  const mFull = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });

  const GROUPS: Array<{ f: string; due: (m: Date, itemIdx: number) => boolean }> = [
    { f: "Monthly", due: () => true },
    { f: "Quarterly", due: (m) => [2, 5, 8, 11].includes(m.getMonth()) },
    { f: "Bi-Annually", due: (m) => [3, 9].includes(m.getMonth()) },
    { f: "Annually", due: (m, itemIdx) => m.getMonth() === (itemIdx * 5 + 2) % 12 },
  ];
  const OCC_PER: Record<string, number> = {
    Monthly: 12,
    Quarterly: 4,
    "Bi-Annually": 2,
    Annually: 1,
  };

  let totalOcc = 0;
  let totalItems = 0;
  const groups = GROUPS.map((g) => {
    const items: Array<{ o: ScopeEntity; zName: string; t: { t: string; f: string } }> = [];
    active.forEach((o) =>
      o.zones.forEach((z) =>
        z.tasks.forEach((t) => {
          if (t.f === g.f) items.push({ o, zName: z.name, t });
        })
      )
    );
    totalOcc += items.length * (OCC_PER[g.f] ?? 1);
    totalItems += items.length;
    return { ...g, items };
  }).filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-title-2 text-fg">
          The periodic tail — {totalItems} items, {totalOcc} occurrences in the next 12 months
        </h2>
        <span className="sc-eyebrow">
          {mFull(months[0]!)} → {mFull(months[11]!)}
        </span>
      </div>
      <div className="sc-banner">
        Occurrences generated 12 months ahead — quarterly Mar / Jun / Sep / Dec · bi-annual Apr /
        Oct · annual staggered
      </div>
      <div className="sc-legend">
        <span className="sc-k">
          <span className="sc-dot" />
          occurrence due
        </span>
        <span className="sc-k">
          <span className="sc-sq" />
          no work due
        </span>
        <span className="sc-k">
          <span className="sc-badge sc-badge-amber">BILLABLE EXTRA</span> quoted before scheduling
        </span>
      </div>
      {groups.map((g) => (
        <Card key={g.f}>
          <CardHeader
            title={`${g.f} works`}
            actions={<span className="sc-eyebrow">{g.items.length} scope items</span>}
          />
          <CardBody className="sc-pwrap">
            <div className="sc-pgrid">
              <div className="sc-prow sc-head">
                <div className="sc-pdesc">
                  <FqChip f={g.f} />
                  <span className="sc-zn">
                    {g.items.length} items · {g.items.length * (OCC_PER[g.f] ?? 1)} occurrences
                  </span>
                </div>
                {months.map((m) => (
                  <div key={m.toISOString()} className="sc-mcell">
                    {mLbl(m)}
                  </div>
                ))}
              </div>
              {g.items.map((it, idx) => {
                const billable = /additional cost/i.test(it.t.t);
                return (
                  <div key={`${it.o.id}-${idx}`} className="sc-prow">
                    <div className="sc-pdesc">
                      <span className="sc-ent">{it.o.id}</span>
                      <span className="sc-tx" title={it.t.t}>
                        {it.t.t}
                      </span>
                      {billable && <span className="sc-badge sc-badge-amber">BILLABLE EXTRA</span>}
                      <span className="sc-zn">{it.zName}</span>
                    </div>
                    {months.map((m) => {
                      const due = g.due(m, idx);
                      return (
                        <div
                          key={m.toISOString()}
                          className={`sc-pcell${due ? " sc-due" : ""}`}
                          title={due ? `Due ${mFull(m)} — planned` : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function ScopePage() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);

  const stats = [
    { l: "Contracted h / week", v: fmt1(totHours), s: "cleaning, across 6 entities" },
    { l: "Weekday h / day", v: fmt1(wkDay), s: "Mon–Fri scheduled cover" },
    { l: "Weekend h / day", v: fmt1(weDay), s: "Sat–Sun scheduled cover" },
    { l: "Active scope items", v: String(totItems), small: `+${optItems} OPT`, s: "optional = OC2 retail lots" },
    { l: "Positions", v: String(positions.length), small: "+1 SEC", s: "cleaners + night security" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="sc-mast">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="sc-kicker">Scope · {seed.contract.building}</span>
          {now && (
            <span className="sc-gen">
              GENERATED{" "}
              {now
                .toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
                .toUpperCase()}
            </span>
          )}
        </div>
        <h1>What the cleaning contract actually asks for</h1>
        <p>
          {seed.contract.title}, dated {seed.contract.dated}. {seed.contract.note}
        </p>
      </header>
      <div className="sc-stats">
        {stats.map((t) => (
          <div key={t.l} className="sc-stat">
            <div className="sc-lb">{t.l}</div>
            <div className="sc-v">
              {t.v}
              {t.small && <small> {t.small}</small>}
            </div>
            <div className="sc-sub">{t.s}</div>
          </div>
        ))}
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope">Scope explorer</TabsTrigger>
          <TabsTrigger value="roster">Weekly roster</TabsTrigger>
          <TabsTrigger value="gantt">Day gantt</TabsTrigger>
          <TabsTrigger value="periodic">Periodic planner</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewView />
        </TabsContent>
        <TabsContent value="scope">
          <ScopeView />
        </TabsContent>
        <TabsContent value="roster">
          <RosterView />
        </TabsContent>
        <TabsContent value="gantt">
          <GanttView />
        </TabsContent>
        <TabsContent value="periodic">{now && <PeriodicView now={now} />}</TabsContent>
      </Tabs>
    </div>
  );
}
