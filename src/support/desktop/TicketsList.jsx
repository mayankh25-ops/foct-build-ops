// Tickets list — calm, scannable table in the style of modern issue trackers:
// a two-line subject cell, muted uppercase headers, status as dot + text
// (no pill noise), priority colored only when it needs attention.
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { C, FONT, DEFAULT_LEVELS, DEFAULT_CATEGORIES, PRIORITIES } from '../constants';
import { mono, Chip, StatusText } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const STATUS_FILTERS = ['All', 'Open', 'In progress', 'Completed', 'Awaiting invoice', 'Closed'];

function statusMatch(filter, status) {
  if (filter === 'All') return true;
  if (filter === 'Open') return status === 'open' || status === 'assigned';
  if (filter === 'In progress') return status === 'inprogress' || status === 'attended';
  if (filter === 'Completed') return status === 'completed' || status === 'unable';
  if (filter === 'Awaiting invoice') return status === 'awaiting';
  if (filter === 'Closed') return status === 'closed';
  return true;
}

export default function TicketsList({ q, openTicket, role, canBilling, clearQ }) {
  const { tickets, enrich } = useSupport();
  const [fStatus, setFStatus] = useState('All');
  const [fLevel, setFLevel] = useState('All levels');
  const [fCat, setFCat] = useState('All categories');
  const [hover, setHover] = useState(null);
  const isCleaning = role === 'cleaning';

  const rows = useMemo(() => {
    const all = tickets.map(enrich);
    const scope = isCleaning ? all.filter((t) => t.team) : all;
    const toks = (q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return scope.filter((t) => {
      if (!statusMatch(fStatus, t.status)) return false;
      if (fLevel !== 'All levels' && t.level !== fLevel) return false;
      if (fCat !== 'All categories' && t.cat !== fCat) return false;
      if (toks.length) {
        const hay = [
          t.ticketNo, t.level, 'level', String(t.level).replace(/^L/i, ''), t.levelText,
          t.area, t.cat, t.desc, t.team, t.by, t.stL, t.prio,
        ].join(' ').toLowerCase();
        return toks.every((k) => hay.includes(k));
      }
      return true;
    });
  }, [tickets, enrich, q, fStatus, fLevel, fCat, isCleaning]);

  const gridCols = canBilling
    ? '96px minmax(0,2fr) 96px 150px minmax(0,1.2fr) 104px 96px'
    : '96px minmax(0,2fr) 96px 150px minmax(0,1.2fr) 104px';
  const headCell = {
    ...mono, fontSize: 10.5, letterSpacing: '0.06em', color: C.faint, fontWeight: 500,
    textTransform: 'uppercase',
  };
  const select = {
    height: 34, border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff',
    fontSize: 12.5, color: C.slate, padding: '0 8px', cursor: 'pointer', fontFamily: FONT,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((l) => (
          <Chip key={l} active={fStatus === l} onClick={() => setFStatus(l)}>{l}</Chip>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={fLevel} onChange={(e) => setFLevel(e.target.value)} style={select}>
            {['All levels', ...DEFAULT_LEVELS].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={select}>
            {['All categories', ...DEFAULT_CATEGORIES].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <span style={{ ...mono, fontSize: 11, color: C.faint }}>{rows.length}</span>
        </div>
      </div>

      <div style={{
        background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
        boxShadow: '0 1px 2px rgba(14,15,17,0.04)', overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 16, padding: '11px 20px', borderBottom: `1px solid ${C.wash}` }}>
          <span style={headCell}>Ticket</span>
          <span style={headCell}>Subject</span>
          <span style={headCell}>Priority</span>
          <span style={headCell}>Status</span>
          <span style={headCell}>Assigned to</span>
          <span style={headCell}>Created</span>
          {canBilling && <span style={headCell}>Billing</span>}
        </div>
        {rows.map((r) => {
          const prioAttention = r.prio === 'Urgent' || r.prio === 'High';
          return (
            <div
              key={r.id}
              onClick={() => openTicket(r.id)}
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
              style={{
                display: 'grid', gridTemplateColumns: gridCols, gap: 16, padding: '13px 20px',
                borderBottom: `1px solid ${C.bg}`, alignItems: 'center', cursor: 'pointer',
                background: hover === r.id ? C.paper : '#fff', transition: 'background 0.1s',
              }}
            >
              <span style={{ ...mono, fontSize: 12.5, color: C.grey, display: 'flex', alignItems: 'center', gap: 6 }}>
                {r.ticketNo}
                {r.synced === false && (
                  <span title="Saved on this device — will sync"
                    style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber, flex: 'none' }} />
                )}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.cat} — {r.area}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.levelText} · {(r.by || '').split(' ·')[0]}
                </span>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, whiteSpace: 'nowrap',
                color: prioAttention ? PRIORITIES[r.prio] : C.slate,
                fontWeight: prioAttention ? 600 : 400,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flex: 'none',
                  background: prioAttention ? PRIORITIES[r.prio] : C.hair,
                }} />
                {r.prio}
              </span>
              <StatusText status={r.status} />
              <span style={{ fontSize: 13, color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.team || <span style={{ color: C.faint }}>Unassigned</span>}
              </span>
              <span style={{ ...mono, fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>{r.createdD}</span>
              {canBilling && (
                <span style={{ fontSize: 12.5, whiteSpace: 'nowrap', color: r.chargeable ? (r.invoiceNo ? C.slate : C.amber) : C.hair }}>
                  {r.chargeable ? (r.invoiceNo ? 'Invoiced' : 'Chargeable') : '—'}
                </span>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <Search size={34} color={C.hair} strokeWidth={1.5} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>No tickets match</div>
            <div style={{ fontSize: 13.5, color: C.grey, margin: '4px 0 16px' }}>Try a different search or clear the filters.</div>
            <button
              onClick={() => { setFStatus('All'); setFLevel('All levels'); setFCat('All categories'); clearQ?.(); }}
              style={{
                height: 34, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8,
                padding: '0 14px', fontSize: 13, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
