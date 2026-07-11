/* eslint-disable react-refresh/only-export-components */
// Shared analytics primitives — used by the admin dashboard, the concierge
// dashboard, and the phone Insights screen so all three read the same truth.
//
// Status colors are semantic (blue open / amber in-progress / green done) and
// validated for CVD separation + contrast; identity is never color-alone —
// every segment and bar carries a direct label and count.
import React, { useMemo } from 'react';
import { C, FONT, levelText } from './constants';
import { mono } from './ui.jsx';
import { useSupport } from './store.jsx';

export const STATUS_MIX = [
  { key: 'open', label: 'Open', statuses: ['open', 'assigned'], color: C.blue },
  { key: 'progress', label: 'In progress', statuses: ['inprogress', 'attended'], color: C.amber },
  { key: 'done', label: 'Completed', statuses: ['completed', 'awaiting', 'closed'], color: C.green },
];

// One pass over the ticket store -> everything the charts need.
export function useAnalytics() {
  const { tickets, enrich } = useSupport();
  return useMemo(() => {
    const all = tickets.map(enrich);
    const mix = STATUS_MIX.map((m) => ({
      ...m,
      n: all.filter((t) => m.statuses.includes(t.status)).length,
    })).filter((m) => m.n > 0);
    const total = mix.reduce((a, m) => a + m.n, 0);

    const catCounts = {};
    all.forEach((t) => { catCounts[t.cat] = (catCounts[t.cat] || 0) + 1; });
    const tags = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    const lvCounts = {};
    all.forEach((t) => { lvCounts[t.level] = (lvCounts[t.level] || 0) + 1; });
    const levels = Object.entries(lvCounts).sort((a, b) => b[1] - a[1]);

    const openN = all.filter((t) => ['open', 'assigned'].includes(t.status)).length;
    const progN = all.filter((t) => ['inprogress', 'attended'].includes(t.status)).length;
    const doneN = all.filter((t) => ['completed', 'awaiting', 'closed'].includes(t.status)).length;
    const urgentN = all.filter((t) => t.prio === 'Urgent' && !['completed', 'closed'].includes(t.status)).length;

    return { all, mix, total, tags, levels, openN, progN, doneN, urgentN };
  }, [tickets, enrich]);
}

// Donut of the current status mix, center total, legend with counts.
export function StatusDonut({ mix, total, size = 128 }) {
  let acc = 0;
  const segs = mix.map((m) => {
    const p = total ? (m.n / total) * 100 : 0;
    const seg = { ...m, dash: `${Math.max(p - 1.2, 0.4)} ${100 - Math.max(p - 1.2, 0.4)}`, off: String(-acc - 0.6) };
    acc += p;
    return seg;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg viewBox="0 0 140 140" role="img" aria-label={`Status mix — ${total} tickets`}
        style={{ width: size, height: size, flex: 'none' }}>
        <circle cx="70" cy="70" r="52" fill="none" stroke={C.wash} strokeWidth="17" />
        {segs.map((d) => (
          <circle key={d.key} cx="70" cy="70" r="52" fill="none" stroke={d.color} strokeWidth="17"
            strokeLinecap="butt" pathLength="100" strokeDasharray={d.dash} strokeDashoffset={d.off}
            transform="rotate(-90 70 70)">
            <title>{`${d.label}: ${d.n} of ${total}`}</title>
          </circle>
        ))}
        <text x="70" y="66" textAnchor="middle" style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, fill: C.ink }}>
          {total.toLocaleString()}
        </text>
        <text x="70" y="84" textAnchor="middle" style={{ ...mono, fontSize: 8.5, fill: C.faint, letterSpacing: '0.08em' }}>
          TICKETS
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 0 }}>
        {mix.map((d) => (
          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={`${d.label}: ${d.n}`}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flex: 'none' }} />
            <span style={{ fontSize: 12.5, color: C.slate, whiteSpace: 'nowrap' }}>{d.label}</span>
            <span style={{ ...mono, fontSize: 11.5, color: C.faint, marginLeft: 'auto', paddingLeft: 10 }}>
              {d.n.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal labeled bars — magnitude, top entry gets the brand accent.
export function HBars({ data, labelWidth = 118, accentFirst = true, format = (v) => v }) {
  const max = Math.max(...data.map(([, n]) => n), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(([labelText, n], i) => (
        <div key={labelText} title={`${labelText}: ${format(n)}`}
          style={{ display: 'grid', gridTemplateColumns: `${labelWidth}px 1fr 34px`, gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {labelText}
          </span>
          <div style={{ height: 10, background: C.wash, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${Math.round((n / max) * 100)}%`,
              background: accentFirst && i === 0 ? C.brand : C.inkSoft,
            }} />
          </div>
          <span style={{ ...mono, fontSize: 11.5, color: C.grey, textAlign: 'right' }}>{format(n)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ title, right, children, pad = '14px 20px 18px' }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
      boxShadow: '0 1px 2px rgba(14,15,17,0.04)',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', color: C.ink, margin: 0 }}>{title}</h3>
        {right}
      </div>
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

export { levelText };
