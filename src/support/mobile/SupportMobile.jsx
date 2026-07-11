// Phone app — faithful to the "Mobile App" design: big buttons, chips and
// photos, almost no typing. Concierge home + cleaner "My jobs" + create
// wizard + job/ticket detail. Works fully offline; shows sync state.
import React, { useState, useCallback } from 'react';
import { Camera, Search, CheckCheck, Clock, CheckCircle2, Ticket, PieChart } from 'lucide-react';
import { C, FONT, fmtTime } from '../constants';
import { mono, SyncPill, Toast, StatusBadge, GlobalSupportStyles } from '../ui.jsx';
import { useSupport } from '../store.jsx';
import Login from '../desktop/Login.jsx';
import MCreate from './MCreate.jsx';
import MDetail from './MDetail.jsx';
import MInsights from './MInsights.jsx';

const screenPad = { paddingLeft: 20, paddingRight: 20 };

export default function SupportMobile() {
  const { session, booted, sync } = useSupport();
  const [nav, setNav] = useState({ screen: 'home', id: null, filter: 'today' });

  const go = useCallback((screen, id = null) => {
    setNav((n) => ({ ...n, screen, id }));
    window.scrollTo(0, 0);
  }, []);

  if (!booted) return null;
  if (!session) {
    return (
      <div className="support-app">
        <GlobalSupportStyles />
        <Login compact />
        <Toast />
      </div>
    );
  }

  const isCleaning = session.role === 'cleaning';
  const offline = !sync.online && session.mode === 'live';

  let body;
  if (nav.screen === 'create') body = <MCreate go={go} />;
  else if (nav.screen === 'detail') body = <MDetail id={nav.id} go={go} />;
  else if (nav.screen === 'insights') body = <MInsights go={go} />;
  else if (nav.screen === 'jobs' || (nav.screen === 'home' && isCleaning)) {
    body = <MJobs go={go} filter={nav.filter} setFilter={(f) => setNav((n) => ({ ...n, filter: f }))} />;
  } else if (nav.screen === 'tickets') body = <MTickets go={go} />;
  else body = <MHome go={go} />;

  return (
    <div className="support-app" style={{
      fontFamily: FONT, color: C.body, minHeight: '100dvh', background: '#fff',
      maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column',
    }}>
      <GlobalSupportStyles />
      {offline && (
        <div style={{ background: C.amberWash, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={14} color={C.amber} strokeWidth={1.75} />
          <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: C.amber }}>
            WORKING OFFLINE{sync.pending ? ` — ${sync.pending} ${sync.pending === 1 ? 'CHANGE' : 'CHANGES'} QUEUED` : ' — CHANGES SAVE TO THIS PHONE'}
          </span>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
        {body}
      </div>
      <Toast />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concierge home
// ---------------------------------------------------------------------------
function MHome({ go }) {
  const { session, tickets, enrich, signOut } = useSupport();
  const all = tickets.map(enrich);
  const mine = all.filter((t) => !['closed'].includes(t.status)).length;
  const firstName = (session?.name || '').split(' ')[0];

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 18px' }}>
        <img src="/support/logo-dark.png" alt="Focused Facilities Management" style={{ height: 21, width: 'auto' }} onDoubleClick={signOut} />
        <SyncPill compact />
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: C.ink }}>
        Good morning,<br />{firstName}.
      </div>
      <div style={{ fontSize: 14, color: C.grey, marginTop: 4 }}>Auro Tower · {session.roleLabel.includes('Concierge') ? 'Front desk' : session.roleLabel}</div>

      <button onClick={() => go('create')} style={{
        marginTop: 22, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        background: C.brand, color: '#fff', border: 'none', borderRadius: 14,
        fontFamily: FONT, fontSize: 17, fontWeight: 700, cursor: 'pointer', width: '100%',
      }}>
        <Camera size={22} strokeWidth={1.75} />
        Create ticket
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <button onClick={() => go('tickets')} style={halfBtn}>
          My tickets
          <span style={{ ...mono, fontSize: 11, background: C.wash, borderRadius: 999, padding: '2px 8px', color: C.slate }}>{mine}</span>
        </button>
        <button onClick={() => go('tickets')} style={halfBtn}>
          <Search size={18} strokeWidth={1.75} />
          Search
        </button>
      </div>
      <button onClick={() => go('insights')} style={{ ...halfBtn, width: '100%', marginTop: 10 }}>
        <PieChart size={18} color={C.brand} strokeWidth={1.75} />
        Today&apos;s insights
      </button>

      <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, margin: '26px 0 10px' }}>TODAY AT AURO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {all.slice(0, 6).map((t) => {
          const undelivered = t.status === 'assigned' && t.synced !== false;
          return (
            <div key={t.id} onClick={() => go('detail', t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              border: `1px solid ${t.synced === false ? C.amberLine : C.wash}`,
              background: t.synced === false ? C.amberBg : '#fff',
              borderRadius: 12, padding: '13px 14px', cursor: 'pointer',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{t.cat} — {t.area}</div>
                <div style={{ ...mono, fontSize: 10.5, color: C.faint, marginTop: 2 }}>
                  {t.ticketNo} · {t.levelText} · {fmtTime(t.created) !== '—' ? fmtTime(t.created) : t.createdD.split(', ')[1] || ''}
                </div>
                {t.synced === false ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <Clock size={12} color={C.amber} strokeWidth={2} style={{ flex: 'none' }} />
                    <span style={{ ...mono, fontSize: 9, letterSpacing: '0.06em', color: C.amber }}>QUEUED ON THIS PHONE — SYNCS AUTOMATICALLY</span>
                  </div>
                ) : ['inprogress', 'attended', 'completed'].includes(t.status) && t.team ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <CheckCheck size={12} color={C.green} strokeWidth={2} style={{ flex: 'none' }} />
                    <span style={{ ...mono, fontSize: 9, letterSpacing: '0.06em', color: C.green }}>
                      RECEIVED · {(t.team.split('—')[0] || '').trim().toUpperCase()}
                    </span>
                  </div>
                ) : undelivered ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <Clock size={12} color={C.amber} strokeWidth={2} style={{ flex: 'none' }} />
                    <span style={{ ...mono, fontSize: 9, letterSpacing: '0.06em', color: C.amber }}>NOT DELIVERED — CLEANER OFFLINE</span>
                  </div>
                ) : null}
              </div>
              <StatusBadge status={t.status} style={{ fontSize: 11, padding: '4px 10px' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const halfBtn = {
  height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: C.ink, cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// Cleaner "My jobs"
// ---------------------------------------------------------------------------
function MJobs({ go, filter, setFilter }) {
  const { session, tickets, enrich, signOut } = useSupport();
  const all = tickets.map(enrich);
  const activeStatuses = ['assigned', 'inprogress', 'attended'];
  const queue = all.filter((t) => t.team && activeStatuses.includes(t.status));
  const completed = all.filter((t) => t.team && ['completed', 'awaiting', 'closed', 'unable'].includes(t.status));
  const shown = filter === 'completed' ? completed : filter === 'all' ? [...queue, ...completed] : queue;
  const firstName = (session?.name || '').split(' ')[0];

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 4px' }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: C.ink }} onDoubleClick={signOut}>
          My jobs
        </div>
        <SyncPill compact />
      </div>
      <div style={{ fontSize: 13.5, color: C.grey }}>{firstName} · {session.roleLabel.replace('Cleaning team — ', '')} — Auro Tower</div>

      <button onClick={() => go('create')} style={{
        marginTop: 16, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: '#fff', border: `1.5px dashed ${C.hair}`, borderRadius: 12,
        fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: C.ink, cursor: 'pointer', width: '100%',
      }}>
        <Camera size={18} color={C.brand} strokeWidth={1.75} style={{ flex: 'none' }} />
        Report an issue
      </button>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
        {[['today', `Today · ${queue.length}`], ['all', 'All'], ['completed', 'Completed']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            height: 38, padding: '0 15px', borderRadius: 999,
            border: filter === k ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
            background: filter === k ? C.ink : '#fff', fontSize: 13,
            fontWeight: filter === k ? 600 : 400, color: filter === k ? '#fff' : C.slate,
            cursor: 'pointer', fontFamily: FONT,
          }}>
            {l}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: C.greenWash, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <CheckCircle2 size={36} color={C.green} strokeWidth={1.75} />
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: C.ink }}>Queue clear</div>
          <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.55, margin: '12px 0 0' }}>
            No jobs assigned to you right now. New tickets appear here the moment they are assigned.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map((t, i) => {
            const upNext = filter !== 'completed' && i === 0 && activeStatuses.includes(t.status);
            return (
              <div key={t.id} style={{
                border: upNext ? `1.5px solid ${C.ink}` : `1px solid ${C.wash}`,
                borderRadius: 16, padding: 16, position: 'relative',
              }}>
                {upNext && (
                  <span style={{
                    position: 'absolute', top: -9, left: 14, background: C.brand, color: '#fff',
                    ...mono, fontSize: 9, letterSpacing: '0.08em', borderRadius: 999, padding: '3px 9px',
                  }}>
                    UP NEXT
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...mono, fontSize: 12, color: C.ink }}>{t.ticketNo}</span>
                  <StatusBadge status={t.status} style={{ fontSize: 11, padding: '4px 10px' }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginTop: 8 }}>{t.cat} — {t.area}</div>
                <div style={{ ...mono, fontSize: 11, color: C.grey, marginTop: 3 }}>
                  {t.levelText} · {t.prio.toUpperCase()} · {t.nbShown} {t.nbShown === 1 ? 'PHOTO' : 'PHOTOS'}
                </div>
                {upNext ? (
                  <button onClick={() => go('detail', t.id)} style={{
                    marginTop: 12, width: '100%', height: 48, background: C.ink, color: '#fff',
                    border: 'none', borderRadius: 12, fontFamily: FONT, fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Open job
                  </button>
                ) : (
                  <button onClick={() => go('detail', t.id)} style={{
                    position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer',
                  }} aria-label={`Open ${t.ticketNo}`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concierge "My tickets" list (search + all tickets)
// ---------------------------------------------------------------------------
function MTickets({ go }) {
  const { tickets, enrich } = useSupport();
  const [q, setQ] = useState('');
  const all = tickets.map(enrich);
  const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = toks.length
    ? all.filter((t) => {
        const hay = [t.ticketNo, t.level, t.levelText, t.area, t.cat, t.desc, t.stL, t.prio].join(' ').toLowerCase();
        return toks.every((k) => hay.includes(k));
      })
    : all;

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 14px' }}>
        <span onClick={() => go('home')} style={{ fontSize: 15, color: C.brand, fontWeight: 600, cursor: 'pointer' }}>‹ Home</span>
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>Tickets</span>
        <SyncPill compact />
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <Search size={16} color={C.faint} strokeWidth={1.75} style={{ position: 'absolute', left: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search — try "Level 7 graffiti"'
          style={{
            width: '100%', height: 44, padding: '0 12px 0 36px', border: `1px solid ${C.line}`,
            borderRadius: 11, fontSize: 14, background: C.paper, color: C.ink, fontFamily: FONT,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((t) => (
          <div key={t.id} onClick={() => go('detail', t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.wash}`,
            borderRadius: 12, padding: '13px 14px', cursor: 'pointer',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{t.cat} — {t.area}</div>
              <div style={{ ...mono, fontSize: 10.5, color: C.faint, marginTop: 2 }}>{t.ticketNo} · {t.levelText} · {t.createdD}</div>
            </div>
            <StatusBadge status={t.status} style={{ fontSize: 11, padding: '4px 10px' }} />
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: C.grey }}>
            <Ticket size={30} color={C.hair} strokeWidth={1.5} style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: C.ink }}>No tickets match</div>
            <div style={{ fontSize: 13 }}>Try a different search.</div>
          </div>
        )}
      </div>
    </div>
  );
}
