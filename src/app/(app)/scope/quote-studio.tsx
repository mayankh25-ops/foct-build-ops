"use client";

import * as React from "react";
import { Calculator, Info } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SCOPE_SEED } from "@/lib/scope-data";

/**
 * Quote studio — the workloading engine over the Scope dataset. Editable
 * area + productivity assumptions produce CALCULATED weekly hours per
 * entity, compared against the contract's stated hours (under-scoped =
 * margin risk). Machine fleet and award-rate labour costing follow from
 * the same inputs. All figures update live; nothing here is hand-typed
 * into the quote.
 */

interface AreaRow {
  ocId: string;
  hard: number; // m² hard floor per service day
  carpet: number; // m² carpet
  wet: number; // m² wet areas / restrooms
}

/** Defaults sized from the entity descriptions — the admin tunes these. */
const DEFAULT_AREAS: AreaRow[] = [
  { ocId: "OC1", hard: 2600, carpet: 1200, wet: 420 },
  { ocId: "OC3", hard: 900, carpet: 0, wet: 40 },
  { ocId: "OC5", hard: 120, carpet: 260, wet: 30 },
  { ocId: "OC6", hard: 1500, carpet: 2400, wet: 300 },
  { ocId: "OC8", hard: 1100, carpet: 1300, wet: 260 },
  { ocId: "OC9", hard: 900, carpet: 1100, wet: 240 },
  { ocId: "OC10", hard: 1200, carpet: 1200, wet: 220 },
];

interface Rates {
  hard: number; // m²/h manual mop+spot
  carpet: number; // m²/h vacuum
  wet: number; // m²/h restrooms & wet areas
  scrubber: number; // m²/h with walk-behind auto-scrubber
  baseRate: number; // $/h weekday (Cleaning Services Award reference)
  satMult: number;
  sunMult: number;
  onCostPct: number; // super, workers comp, leave loading, payroll tax
  marginPct: number;
}

const DEFAULT_RATES: Rates = {
  hard: 280,
  carpet: 350,
  wet: 100,
  scrubber: 1100,
  baseRate: 28.3,
  satMult: 1.5,
  sunMult: 2,
  onCostPct: 25,
  marginPct: 18,
};

const fmt1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-AU", { minimumFractionDigits: 1 });
const fmt$ = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function daysPerWeek(days: string): number {
  if (/mon–sun|mon-sun/i.test(days)) return 7;
  if (/mon–sat|mon-sat/i.test(days)) return 6;
  return 5;
}

function NumberCell({
  value,
  onChange,
  suffix,
  width = "w-24",
}: {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  width?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        className={`${width} text-right font-numeric tabular-nums`}
        value={String(value)}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      {suffix && <span className="text-caption text-fg-muted">{suffix}</span>}
    </span>
  );
}

export function QuoteStudioView() {
  const [areas, setAreas] = React.useState(DEFAULT_AREAS);
  const [rates, setRates] = React.useState(DEFAULT_RATES);

  const setArea = (ocId: string, key: keyof Omit<AreaRow, "ocId">, n: number) =>
    setAreas((rows) => rows.map((r) => (r.ocId === ocId ? { ...r, [key]: n } : r)));
  const setRate = (key: keyof Rates, n: number) => setRates((r) => ({ ...r, [key]: n }));

  const active = SCOPE_SEED.ocs.filter((o) => o.included);

  // ---- workloading: calculated weekly hours per entity ----
  const totalHardM2 = areas.reduce((n, a) => n + a.hard, 0);
  const useScrubber = totalHardM2 > 1500;
  const rows = active.map((oc) => {
    const a = areas.find((r) => r.ocId === oc.id) ?? { hard: 0, carpet: 0, wet: 0 };
    const d = daysPerWeek(oc.days);
    const hardRate = useScrubber && a.hard > 800 ? rates.scrubber : rates.hard;
    const dailyH = a.hard / hardRate + a.carpet / rates.carpet + a.wet / rates.wet;
    const calc = Math.round(dailyH * d * 10) / 10;
    const delta = Math.round((oc.weeklyHours - calc) * 10) / 10;
    // negative delta = contract states FEWER hours than the work needs
    return { oc, a, days: d, calc, contract: oc.weeklyHours, delta };
  });
  const calcTotal = rows.reduce((n, r) => n + r.calc, 0);
  const contractTotal = rows.reduce((n, r) => n + r.contract, 0);

  // ---- machine recommendation ----
  const totalCarpetM2 = areas.reduce((n, a) => n + a.carpet, 0);
  const machines: Array<{ name: string; qty: number; why: string }> = [];
  if (totalHardM2 > 4000)
    machines.push({
      name: "Ride-on scrubber-drier (small, 55 cm)",
      qty: 1,
      why: `${totalHardM2.toLocaleString()} m² total hard floor — ride-on pays for itself past ~4,000 m²`,
    });
  const walkBehinds = Math.max(totalHardM2 > 4000 ? 1 : 0, Math.ceil(totalHardM2 / 3000));
  if (walkBehinds)
    machines.push({
      name: "Walk-behind auto-scrubber (43–50 cm)",
      qty: walkBehinds,
      why: `~3,000 m² hard floor per machine per shift at ${rates.scrubber} m²/h`,
    });
  const vacs = Math.max(1, Math.ceil(totalCarpetM2 / 1400));
  machines.push({
    name: "Backpack vacuum (commercial)",
    qty: vacs,
    why: `${totalCarpetM2.toLocaleString()} m² carpet — one unit per ~1,400 m² daily pass`,
  });
  if (totalCarpetM2 > 500)
    machines.push({
      name: "Carpet extractor (periodic)",
      qty: 1,
      why: "Quarterly/annual carpet works in the periodic tail",
    });
  if (totalHardM2 > 1500)
    machines.push({
      name: "Burnisher (stone/vinyl polish)",
      qty: 1,
      why: "Foyer marble buffing + periodic hard-floor program",
    });
  machines.push({
    name: "Janitor carts + microfibre sets",
    qty: SCOPE_SEED.positions.length,
    why: "One per rostered position",
  });

  // ---- award-rate labour costing from the indicative roster ----
  const wkHoursDay = SCOPE_SEED.positions.reduce((n, p) => n + (p.wk?.h ?? 0), 0);
  const weHoursDay = SCOPE_SEED.positions.reduce((n, p) => n + (p.we?.h ?? 0), 0);
  const weekdayCost = wkHoursDay * 5 * rates.baseRate;
  const weekendCost = weHoursDay * rates.baseRate * (rates.satMult + rates.sunMult);
  const labour = weekdayCost + weekendCost;
  const onCosts = labour * (rates.onCostPct / 100);
  const costWeekly = labour + onCosts;
  const priceWeekly = costWeekly / (1 - rates.marginPct / 100);
  const priceAnnual = priceWeekly * 52;

  return (
    <div className="flex flex-col gap-4">
      <div className="sc-banner">
        <Calculator aria-hidden className="size-3.5 shrink-0" />
        Workloading proposal — edit the areas and rates; hours, machines and price recalculate live
      </div>

      {/* assumptions */}
      <div className="grid items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
            <h3 className="text-title-3 text-fg">Areas by entity</h3>
            <span className="sc-eyebrow">m² per service day</span>
          </div>
          <CardBody className="sc-tablewrap">
            <table className="sc-roster" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Hard floor</th>
                  <th>Carpet</th>
                  <th>Wet areas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ oc, a }) => (
                  <tr key={oc.id}>
                    <td>
                      <span className="sc-pos-name">
                        <b>{oc.id}</b>
                        <span>{oc.name.toUpperCase()}</span>
                      </span>
                    </td>
                    <td>
                      <NumberCell value={a.hard} onChange={(n) => setArea(oc.id, "hard", n)} suffix="m²" />
                    </td>
                    <td>
                      <NumberCell value={a.carpet} onChange={(n) => setArea(oc.id, "carpet", n)} suffix="m²" />
                    </td>
                    <td>
                      <NumberCell value={a.wet} onChange={(n) => setArea(oc.id, "wet", n)} suffix="m²" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
            <h3 className="text-title-3 text-fg">Rates</h3>
            <span className="sc-eyebrow">productivity + award</span>
          </div>
          <CardBody className="flex flex-col gap-3">
            {(
              [
                ["carpet", "Vacuum carpet", "m²/h"],
                ["hard", "Mop / spot hard floor", "m²/h"],
                ["scrubber", "Auto-scrubber", "m²/h"],
                ["wet", "Wet areas & restrooms", "m²/h"],
                ["baseRate", "Base weekday rate", "$/h"],
                ["satMult", "Saturday multiplier", "×"],
                ["sunMult", "Sunday multiplier", "×"],
                ["onCostPct", "On-costs (super, comp)", "%"],
                ["marginPct", "Margin", "%"],
              ] as const
            ).map(([key, label, suffix]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-body-sm text-fg">
                {label}
                <NumberCell value={rates[key]} onChange={(n) => setRate(key, n)} suffix={suffix} width="w-20" />
              </label>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* calculated vs contract */}
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
          <h3 className="text-title-3 text-fg">Calculated hours vs the contract</h3>
          <span className="sc-eyebrow">
            calc {fmt1(calcTotal)} · contract {fmt1(contractTotal)} h/wk
          </span>
        </div>
        <CardBody>
          {rows.map(({ oc, calc, contract, delta, days }) => {
            const max = Math.max(calc, contract, 1);
            const underScoped = delta < -3;
            const fat = delta > 3;
            return (
              <div key={oc.id} className="border-b border-edge py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-body-sm font-medium text-fg">
                    <span className="sc-mono mr-2 text-fg-muted">{oc.id}</span>
                    {oc.name}
                    <span className="ml-2 text-caption text-fg-muted">{days} d/wk</span>
                  </p>
                  {underScoped ? (
                    <StatusPill tone="critical">Under-scoped {fmt1(-delta)} h/wk — margin risk</StatusPill>
                  ) : fat ? (
                    <StatusPill tone="warning">Contract carries +{fmt1(delta)} h/wk</StatusPill>
                  ) : (
                    <StatusPill tone="success">Reconciles</StatusPill>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-caption text-fg-muted">calc</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-hover">
                      <span className="block h-full rounded-pill bg-chart-1" style={{ width: `${(calc / max) * 100}%` }} />
                    </span>
                    <span className="w-20 text-right font-numeric text-caption text-fg-secondary tabular-nums">
                      {fmt1(calc)} h/wk
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-caption text-fg-muted">contract</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-pill bg-hover">
                      <span className="block h-full rounded-pill bg-chart-2" style={{ width: `${(contract / max) * 100}%` }} />
                    </span>
                    <span className="w-20 text-right font-numeric text-caption text-fg-secondary tabular-nums">
                      {fmt1(contract)} h/wk
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {/* machines */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
            <h3 className="text-title-3 text-fg">Recommended equipment</h3>
            <span className="sc-eyebrow">
              {totalHardM2.toLocaleString()} m² hard · {totalCarpetM2.toLocaleString()} m² carpet
            </span>
          </div>
          <CardBody className="flex flex-col gap-0">
            {machines.map((m) => (
              <div key={m.name} className="flex items-start justify-between gap-4 border-b border-edge py-3 last:border-b-0">
                <div>
                  <p className="text-body-sm font-medium text-fg">{m.name}</p>
                  <p className="mt-0.5 text-body-sm text-fg-muted">{m.why}</p>
                </div>
                <span className="shrink-0 font-numeric text-title-2 text-fg tabular-nums">×{m.qty}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* price */}
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-edge px-6 py-4">
            <h3 className="text-title-3 text-fg">Indicative price</h3>
            <Badge tone="warning">Draft — not a formal quote</Badge>
          </div>
          <CardBody>
            <dl className="flex flex-col gap-2.5 text-body-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-secondary">Weekday labour · {fmt1(wkHoursDay * 5)} h/wk</dt>
                <dd className="font-numeric text-fg tabular-nums">{fmt$(weekdayCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-secondary">
                  Weekend labour · {fmt1(weHoursDay * 2)} h/wk (Sat ×{rates.satMult}, Sun ×{rates.sunMult})
                </dt>
                <dd className="font-numeric text-fg tabular-nums">{fmt$(weekendCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-secondary">On-costs · {rates.onCostPct}%</dt>
                <dd className="font-numeric text-fg tabular-nums">{fmt$(onCosts)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-edge pt-2.5">
                <dt className="font-medium text-fg">Cost / week</dt>
                <dd className="font-numeric font-semibold text-fg tabular-nums">{fmt$(costWeekly)}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-fg-secondary">Margin · {rates.marginPct}%</dt>
                <dd className="font-numeric text-fg tabular-nums">{fmt$(priceWeekly - costWeekly)}</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-card bg-accent-subtle p-4">
              <p className="text-caption font-medium tracking-[0.06em] text-accent-text uppercase">Price / week</p>
              <p className="font-numeric text-display text-accent-text tabular-nums">{fmt$(priceWeekly)}</p>
              <p className="mt-1 text-body-sm text-fg-secondary">
                {fmt$(priceAnnual)} / year · covers {fmt1(contractTotal)} contracted h/wk + night security priced separately
              </p>
            </div>
            <p className="mt-4 flex items-start gap-2 text-caption text-fg-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Award reference: Cleaning Services Award base rate with Saturday/Sunday multipliers;
              public holidays, allowances and periodic-works pricing are added at formal quote stage.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
