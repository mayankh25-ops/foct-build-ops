// Billing — chargeable job stats, invoice recording table, Xero banner.
import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { C, FONT } from '../constants';
import { mono, StatusText } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const card = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(14,15,17,0.04)',
};
const gridCols = '110px 1.4fr 0.9fr 1fr 1.3fr 130px';
const headCell = { ...mono, fontSize: 10.5, letterSpacing: '0.06em', color: C.faint, fontWeight: 500 };

export default function Billing({ openTicket }) {
  const { tickets, enrich, patchTicket, showToast } = useSupport();
  const [drafts, setDrafts] = useState({});

  const all = tickets.map(enrich).filter((t) => t.chargeable);
  const awaitingN = all.filter((t) => !t.invoiceNo && ['awaiting', 'completed'].includes(t.status)).length;
  const openN = all.filter((t) => !t.invoiceNo).length;
  const invoicedN = all.filter((t) => t.invoiceNo).length;

  const save = async (t) => {
    const v = (drafts[t.id] || '').trim();
    if (!v) { showToast('Enter the Xero invoice number first', 'err'); return; }
    await patchTicket(t.id, { invoiceNo: v, status: 'closed' });
    setDrafts((d) => ({ ...d, [t.id]: '' }));
    showToast(`${v} recorded — ${t.ticketNo} closed`);
  };

  const stats = [
    { label: 'CHARGEABLE — OPEN', v: openN, sub: 'need an invoice number', c: C.ink },
    { label: 'AWAITING INVOICE', v: awaitingN, sub: 'work done, blocked from closing', c: awaitingN ? C.amber : C.ink },
    { label: 'INVOICED THIS MONTH', v: invoicedN, sub: 'recorded in Xero', c: C.green },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey, marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.wash}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: C.ink, margin: 0 }}>Chargeable jobs</h3>
          <span style={{ fontSize: 12.5, color: C.grey }}>A job cannot be closed until its invoice number is recorded.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.wash}` }}>
          <span style={headCell}>TICKET</span>
          <span style={headCell}>JOB</span>
          <span style={headCell}>COMPLETED</span>
          <span style={headCell}>STATUS</span>
          <span style={headCell}>XERO INVOICE №</span>
          <span />
        </div>
        {all.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, padding: '13px 20px', borderBottom: `1px solid ${C.bg}`, alignItems: 'center' }}>
            <span onClick={() => openTicket(r.id)} style={{ ...mono, fontSize: 12.5, fontWeight: 500, color: C.ink, cursor: 'pointer' }}>
              {r.ticketNo}
            </span>
            <span style={{ fontSize: 13.5, color: C.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.cat} — {r.levelText} {r.area}
            </span>
            <span style={{ ...mono, fontSize: 11.5, color: C.grey }}>{r.completedD}</span>
            <StatusText status={r.status} />
            <span>
              {r.invoiceNo ? (
                <span style={{ ...mono, fontSize: 12.5, color: C.green }}>{r.invoiceNo}</span>
              ) : (
                <input
                  value={drafts[r.id] || ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="INV-…"
                  style={{
                    width: '100%', height: 34, border: `1px solid ${C.line}`, borderRadius: 7,
                    padding: '0 10px', ...mono, fontSize: 12.5, color: C.ink, background: C.paper,
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </span>
            <span style={{ justifySelf: 'end' }}>
              {r.invoiceNo ? (
                <span style={{ ...mono, fontSize: 10.5, letterSpacing: '0.06em', color: C.faint }}>INVOICED</span>
              ) : (
                <button onClick={() => save(r)} style={{
                  height: 34, background: C.ink, color: '#fff', border: 'none', borderRadius: 7,
                  padding: '0 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                }}>
                  Record &amp; close
                </button>
              )}
            </span>
          </div>
        ))}
        {all.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: C.faint, fontSize: 13.5 }}>
            No chargeable jobs right now.
          </div>
        )}
      </div>

      <div style={{ ...card, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.blueWash, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <Receipt size={20} color={C.blue} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>Xero integration</div>
          <div style={{ fontSize: 13, color: C.grey, marginTop: 2 }}>
            Connect Xero to create draft invoices from chargeable jobs and pull invoice numbers back
            automatically. Until then, record numbers manually above.
          </div>
        </div>
        <button
          onClick={() => showToast('Xero connection — coming with the integrations release', 'warn')}
          style={{
            height: 38, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8,
            padding: '0 16px', fontSize: 13.5, fontWeight: 600, color: C.ink, cursor: 'pointer',
            flex: 'none', fontFamily: FONT,
          }}
        >
          Connect Xero
        </button>
      </div>
    </div>
  );
}
