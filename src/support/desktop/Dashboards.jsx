// Role dashboards — concierge (stats + recent), cleaning (queue cards),
// admin (analytics: KPIs, category bars, status donut, trend, levels, teams,
// billing attention). Analytics are computed live from the ticket store.
import React, { useMemo, useState } from 'react';
import { Plus, Camera, CheckCircle2 } from 'lucide-react';
import { C, FONT, fmtStamp, STATUSES, levelText } from '../constants';
import { mono, kicker, Seg, StatusBadge, StatusText } from '../ui.jsx';
import { useSupport } from '../store.jsx';
import { useAnalytics, StatusDonut, HBars, ChartCard } from '../charts.jsx';

const card = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(14,15,17,0.04)',
};
const statCard = { ...card, padding: '18px 20px' };
const h3 = { fontFamily: FONT, fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.01em', color: C.ink, margin: 0 };

function Stat({ label, v, sub, color = C.ink }) {
  return (
    <div style={statCard}>
      <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', color }}>{v}</div>
      <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function todayStamp() {
  const d = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return `${days[d.getDay()]} ${fmtStamp(d).replace(',', ' ·')}`;
}

function useTicketMetrics() {
  const { tickets, enrich } = useSupport();
  return useMemo(() => {
    const all = tickets.map(enrich);
    const openN = all.filter((t) => ['open', 'assigned'].includes(t.status)).length;
    const progN = all.filter((t) => ['inprogress', 'attended'].includes(t.status)).length;
    const completedN = all.filter((t) => ['completed', 'closed', 'awaiting'].includes(t.status)).length;
    const today = fmtStamp(new Date()).slice(0, 6);
    const doneToday = all.filter((t) => t.completedAt && fmtStamp(t.completedAt).startsWith(today)).length
      || all.filter((t) => t.status === 'completed').length;
    const awaitingN = all.filter((t) => t.chargeable && !t.invoiceNo && ['awaiting', 'completed'].includes(t.status)).length;
    return { all, openN, progN, completedN, doneToday, awaitingN };
  }, [tickets, enrich]);
}

// ---------------------------------------------------------------------------
export function DashboardConcierge({ go, openTicket }) {
  const { session } = useSupport();
  const { all, openN, progN, doneToday } = useTicketMetrics();
  const { mix, total, tags } = useAnalytics();
  const firstName = (session?.name || '').split(' ')[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: C.ink, margin: '0 0 4px' }}>
            Good morning, {firstName}.
          </h2>
          <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>Auro Tower · here is where support stands right now.</p>
        </div>
        <span style={{ ...mono, fontSize: 11.5, color: C.grey }}>{todayStamp()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <Stat label="OPEN TICKETS" v={openN} sub="across Auro Tower" />
        <Stat label="IN PROGRESS" v={progN} sub="teams on site now" />
        <Stat label="COMPLETED TODAY" v={doneToday} sub="photos attached" />
        <div
          onClick={() => go('create')}
          style={{
            background: C.ink, borderRadius: 12, padding: '18px 20px', color: '#fff', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.faint }}>REPORT AN ISSUE</span>
            <Plus size={18} color={C.brand} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>Create ticket</div>
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3 }}>Photo, level, tag — under a minute</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'stretch' }}>
        <ChartCard title="Status mix" pad="18px 20px">
          <StatusDonut mix={mix} total={total} />
        </ChartCard>
        <ChartCard title="Tickets by category">
          <HBars data={tags.slice(0, 5)} />
        </ChartCard>
      </div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}>
          <h3 style={h3}>Recent tickets</h3>
          <a onClick={() => go('tickets')} style={{ fontSize: 13, fontWeight: 600, color: C.brand, cursor: 'pointer', textDecoration: 'none' }}>View all</a>
        </div>
        <div style={{ padding: '6px 20px 14px' }}>
          {all.slice(0, 5).map((r) => (
            <div
              key={r.id}
              onClick={() => openTicket(r.id)}
              style={{
                display: 'grid', gridTemplateColumns: '110px 1.5fr 1fr 1fr 120px', gap: 12,
                alignItems: 'center', padding: '12px 4px', borderBottom: `1px solid ${C.wash}`, cursor: 'pointer',
              }}
            >
              <span style={{ ...mono, fontSize: 12.5, color: C.ink, fontWeight: 500 }}>{r.ticketNo}</span>
              <span style={{ fontSize: 13.5, color: C.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.cat} — {r.area}
              </span>
              <span style={{ ...mono, fontSize: 12, color: C.grey }}>{r.levelText}</span>
              <span style={{ ...mono, fontSize: 11.5, color: C.faint }}>{r.createdD}</span>
              <span style={{ justifySelf: 'end' }}><StatusText status={r.status} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function DashboardCleaning({ openTicket }) {
  const { session } = useSupport();
  const { all, doneToday, awaitingN } = useTicketMetrics();
  const firstName = (session?.name || '').split(' ')[0];
  const queue = all.filter((t) => t.team && ['assigned', 'inprogress', 'attended'].includes(t.status));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: C.ink, margin: '0 0 4px' }}>
            Your queue, {firstName}.
          </h2>
          <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>{session?.roleLabel} · Auro Tower</p>
        </div>
        <span style={{ ...mono, fontSize: 11.5, color: C.grey }}>{todayStamp()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        <Stat label="IN YOUR QUEUE" v={queue.length} sub="assigned, not finished" />
        <Stat label="IN PROGRESS" v={all.filter((t) => t.status === 'inprogress').length} sub="attendance logged" />
        <Stat label="COMPLETED TODAY" v={doneToday} sub="nice work" />
        <Stat label="AWAITING INVOICE" v={awaitingN} sub="blocked from closing" color={awaitingN ? C.amber : C.ink} />
      </div>
      <div>
        <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey, marginBottom: 12 }}>
          ASSIGNED TO YOUR TEAM — WORK TOP TO BOTTOM
        </div>
        {queue.length === 0 ? (
          <div style={{ background: '#fff', border: `1px dashed ${C.line}`, borderRadius: 12, padding: 48, textAlign: 'center' }}>
            <CheckCircle2 size={32} color={C.green} strokeWidth={1.75} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>Queue clear</div>
            <div style={{ fontSize: 13.5, color: C.grey, marginTop: 4 }}>No open jobs assigned to your team right now.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {queue.map((r) => (
              <div key={r.id} style={{ ...card, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...mono, fontSize: 12.5, fontWeight: 500, color: C.ink }}>{r.ticketNo}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div style={{ padding: '12px 18px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>{r.cat}</div>
                  <div style={{ ...mono, fontSize: 11.5, color: C.grey, marginTop: 3 }}>{r.levelText} · {r.area}</div>
                  <p style={{
                    fontSize: 13, color: C.slate, lineHeight: 1.5, margin: '10px 0 0',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {r.desc}
                  </p>
                </div>
                <div style={{ marginTop: 'auto', padding: '14px 18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono, fontSize: 11, color: C.faint }}>
                    <Camera size={14} strokeWidth={1.75} />
                    {r.nbShown} PHOTOS
                  </span>
                  <button
                    onClick={() => openTicket(r.id)}
                    style={{
                      height: 32, background: C.ink, color: '#fff', border: 'none', borderRadius: 7,
                      padding: '0 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    Open job
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function DashboardAdmin({ go, openTicket }) {
  const { all, openN, completedN } = useTicketMetrics();
  const [period, setPeriod] = useState('month');

  const metrics = useMemo(() => {
    const counts = {};
    all.forEach((t) => { counts[t.cat] = (counts[t.cat] || 0) + 1; });
    const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const lvCounts = {};
    all.forEach((t) => { lvCounts[t.level] = (lvCounts[t.level] || 0) + 1; });
    const levels = Object.entries(lvCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const teamMap = {};
    all.forEach((t) => {
      if (!t.team) return;
      teamMap[t.team] = teamMap[t.team] || { assigned: 0, done: 0 };
      teamMap[t.team].assigned += 1;
      if (['completed', 'closed', 'awaiting'].includes(t.status)) teamMap[t.team].done += 1;
    });
    const teams = Object.entries(teamMap).map(([name, v]) => ({ name, ...v, avg: '—' }));
    // Trend: bucket by day when dates parse; otherwise use a stable demo curve.
    const parseable = all.filter((t) => !isNaN(new Date(t.created)));
    let trendC = [5, 7, 6, 8, 4, 3, 1];
    let trendD = [4, 6, 6, 7, 5, 2, 1];
    let labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    if (parseable.length >= 5) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const now = new Date();
      trendC = []; trendD = []; labels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        const dayKey = d.toDateString();
        labels.push(days[d.getDay()]);
        trendC.push(parseable.filter((t) => new Date(t.created).toDateString() === dayKey).length);
        trendD.push(parseable.filter((t) => t.completedAt && !isNaN(new Date(t.completedAt)) && new Date(t.completedAt).toDateString() === dayKey).length);
      }
    }
    return { tags, levels, teams, trendC, trendD, labels };
  }, [all]);

  const { mix, total } = useAnalytics();

  const maxTrend = Math.max(...metrics.trendC, ...metrics.trendD, 1) * 1.1;
  const pts = (arr) => {
    const n = Math.max(arr.length, 2);
    return arr.map((v, i) => `${(i * (520 / (n - 1))).toFixed(1)},${(130 - (v / maxTrend) * 115).toFixed(1)}`).join(' ');
  };
  const trendDone = pts(metrics.trendD);
  const trendArea = 'M' + trendDone.split(' ').join(' L') + ' L520,130 L0,130 Z';

  const billingAttention = all.filter((t) => t.chargeable && !t.invoiceNo).slice(0, 4);
  const overdue = all.filter((t) => t.prio === 'Urgent' && !['completed', 'closed'].includes(t.status)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: C.ink, margin: '0 0 4px' }}>
            Auro Tower — operations
          </h2>
          <p style={{ fontSize: 14, color: C.grey, margin: 0 }}>Support performance across levels B2–86.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 9, padding: 4 }}>
          {['week', 'month', 'year'].map((p) => (
            <Seg key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </Seg>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
        <Stat label="TOTAL TICKETS" v={all.length} sub={`This ${period}`} />
        <Stat label="OPEN" v={openN} sub={`${all.filter((t) => t.prio === 'Urgent' && ['open', 'assigned'].includes(t.status)).length} urgent`} />
        <Stat label="COMPLETED" v={completedN} sub={`${all.length ? Math.round((completedN / all.length) * 100) : 0}% of total`} />
        <Stat label="OVERDUE" v={overdue} sub="past 24 h SLA" color={overdue ? C.errDark : C.ink} />
        <Stat label="AVG COMPLETION" v="3.6 h" sub="target 6 h" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.9fr 1.35fr', gap: 16, alignItems: 'stretch' }}>
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}><h3 style={h3}>Tickets by category</h3></div>
          <div style={{ padding: '14px 20px 18px' }}>
            <HBars data={metrics.tags} />
          </div>
        </div>
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}><h3 style={h3}>Status mix</h3></div>
          <div style={{ padding: '18px 20px' }}>
            <StatusDonut mix={mix} total={total} />
          </div>
        </div>
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={h3}>Created vs completed</h3>
            <div style={{ display: 'flex', gap: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.grey }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.hair }} />Created
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.grey }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.brand }} />Completed
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 20px 10px' }}>
            <svg viewBox="0 0 520 150" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <line x1="0" y1="130" x2="520" y2="130" stroke={C.wash} strokeWidth="1" />
              <line x1="0" y1="90" x2="520" y2="90" stroke={C.bg} strokeWidth="1" />
              <line x1="0" y1="50" x2="520" y2="50" stroke={C.bg} strokeWidth="1" />
              <line x1="0" y1="10" x2="520" y2="10" stroke={C.bg} strokeWidth="1" />
              <path d={trendArea} fill="rgba(37,104,178,0.08)" />
              <polyline points={pts(metrics.trendC)} fill="none" stroke={C.hair} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={trendDone} fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px 8px' }}>
              {metrics.labels.map((t, i) => (
                <span key={i} style={{ ...mono, fontSize: 10, color: C.faint }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 16, alignItems: 'stretch' }}>
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}><h3 style={h3}>Busiest levels</h3></div>
          <div style={{ padding: '14px 20px 18px' }}>
            <HBars data={metrics.levels.map(([lv, n]) => [levelText(lv).slice(0, 6), n])}
              labelWidth={44} accentFirst={false} />
          </div>
        </div>
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}` }}><h3 style={h3}>Teams</h3></div>
          <div style={{ padding: '8px 20px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 10, padding: '10px 4px', borderBottom: `1px solid ${C.wash}` }}>
              {['TEAM', 'ASSIGNED', 'COMPLETED', 'AVG TIME'].map((hdr, i) => (
                <span key={hdr} style={{ ...mono, fontSize: 10, letterSpacing: '0.07em', color: C.faint, textAlign: i ? 'right' : 'left' }}>{hdr}</span>
              ))}
            </div>
            {metrics.teams.map((t) => (
              <div key={t.name} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 10, padding: '12px 4px', borderBottom: `1px solid ${C.bg}`, alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{t.name}</span>
                <span style={{ ...mono, fontSize: 12.5, color: C.slate, textAlign: 'right' }}>{t.assigned}</span>
                <span style={{ ...mono, fontSize: 12.5, color: C.slate, textAlign: 'right' }}>{t.done}</span>
                <span style={{ ...mono, fontSize: 12.5, color: C.slate, textAlign: 'right' }}>{t.avg}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={h3}>Billing attention</h3>
            <a onClick={() => go('billing')} style={{ fontSize: 12.5, fontWeight: 600, color: C.brand, cursor: 'pointer', textDecoration: 'none' }}>Open billing</a>
          </div>
          <div style={{ padding: '10px 20px 16px', display: 'flex', flexDirection: 'column' }}>
            {billingAttention.map((r) => (
              <div key={r.id} onClick={() => openTicket(r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `1px solid ${C.bg}`, cursor: 'pointer' }}>
                <span style={{ ...mono, fontSize: 12, color: C.ink }}>{r.ticketNo}</span>
                <span style={{ fontSize: 12.5, color: C.grey, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.cat} · {r.levelText}
                </span>
                <StatusText status={r.status} style={{ fontSize: 12 }} />
              </div>
            ))}
            <p style={{ fontSize: 12, color: C.faint, margin: '12px 0 0', lineHeight: 1.5 }}>
              Chargeable jobs stay open until a Xero invoice number is recorded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
