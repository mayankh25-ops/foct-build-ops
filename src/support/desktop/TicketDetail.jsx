// Ticket detail — description, before/after photos, attendance & completion
// (cleaning), timeline, details, billing (invoice lock), PDF shortcut, close.
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Camera, CheckCircle2, Lock, FileText } from 'lucide-react';
import { C, FONT, fmtStamp } from '../constants';
import { mono, StatusBadge, PrioDot, Toggle, PhotoTile, PhotoInput } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const card = {
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
  boxShadow: '0 1px 2px rgba(14,15,17,0.04)',
};
const label = { ...mono, fontSize: 10.5, letterSpacing: '0.08em', color: C.grey };

export default function TicketDetail({ id, go, role }) {
  const { tickets, enrich, patchTicket, addPhoto, removePhoto, showToast } = useSupport();
  const raw = tickets.find((t) => t.id === id) || tickets[0];
  const [remarks, setRemarks] = useState(raw?.remarks || '');
  const [invDraft, setInvDraft] = useState('');
  useEffect(() => { setRemarks(raw?.remarks || ''); }, [raw?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!raw) {
    return <div style={{ padding: 40, color: C.grey }}>No ticket selected.</div>;
  }
  const cur = enrich(raw);
  const isAdmin = role === 'admin';
  const isCleaning = role === 'cleaning';
  const isConcierge = role === 'concierge';
  const canBilling = isAdmin || isCleaning;
  const active = cur.status !== 'closed';
  const canAttend = isCleaning && active;

  const mark = async (status, extra = {}) => {
    await patchTicket(cur.id, { status, ...extra });
    showToast(`Status — ${status === 'inprogress' ? 'In progress' : status[0].toUpperCase() + status.slice(1)}`);
  };
  const complete = async () => {
    await patchTicket(cur.id, {
      status: 'completed', completedAt: new Date().toISOString(), remarks,
    });
    showToast('Job completed — remarks and photos saved');
  };
  const markUnable = async () => {
    await patchTicket(cur.id, { status: 'unable', remarks });
    showToast('Marked unable to complete — manager notified', 'warn');
  };

  const chargeLocked = cur.chargeable && !cur.invoiceNo;
  const closeLocked = chargeLocked && isCleaning;
  const showClose = (isCleaning || isAdmin) && active;

  const closeTicket = async () => {
    if (chargeLocked) {
      if (cur.status === 'completed') await patchTicket(cur.id, { status: 'awaiting' });
      showToast('Chargeable job — record the invoice number before closing', 'err');
      return;
    }
    await patchTicket(cur.id, { status: 'closed', completedAt: cur.completedAt || new Date().toISOString() });
    showToast(`${cur.ticketNo} closed`);
  };

  const saveInvoice = async () => {
    const v = invDraft.trim();
    if (!v) { showToast('Enter the Xero invoice number first', 'err'); return; }
    await patchTicket(cur.id, { invoiceNo: v });
    setInvDraft('');
    showToast(`${v} recorded — ticket can now be closed`);
  };

  const chargeBadge = cur.chargeable
    ? (cur.invoiceNo ? { t: 'INVOICED', bg: C.greenWash, fg: C.green } : { t: 'CHARGEABLE', bg: C.amberWash, fg: C.amber })
    : { t: 'NOT CHARGEABLE', bg: C.wash, fg: C.grey };

  const timeline = [
    { label: 'Created', v: fmtStamp(cur.created), dot: C.ink, vc: C.ink },
    { label: 'Assigned', v: cur.assignedD, dot: cur.assignedAt ? C.ink : C.line, vc: cur.assignedAt ? C.ink : C.hair },
    { label: 'Attended', v: cur.attendedD, dot: cur.attendedAt ? C.blue : C.line, vc: cur.attendedAt ? C.ink : C.hair },
    { label: 'Completed', v: cur.completedD, dot: cur.completedAt ? C.green : C.line, vc: cur.completedAt ? C.ink : C.hair },
  ];

  const actBtn = (on, fg) => ({
    height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: on ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
    background: on ? C.ink : '#fff', color: on ? '#fff' : (fg || C.slate), fontFamily: FONT,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={() => go('tickets')} style={{
          height: 34, display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
          border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px', fontSize: 13,
          fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: FONT,
        }}>
          <ChevronLeft size={14} strokeWidth={2} />
          Back
        </button>
        <span style={{ ...mono, fontSize: 20, fontWeight: 600, color: C.ink }}>{cur.ticketNo}</span>
        <StatusBadge status={cur.status} />
        <PrioDot color={cur.prioFg} label={`${cur.prio} priority`} style={{ fontSize: 13 }} />
        <span style={{ marginLeft: 'auto', ...mono, fontSize: 11.5, color: C.faint }}>RAISED BY {cur.byUpper}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', color: C.ink }}>{cur.cat}</span>
              <span style={{ ...mono, fontSize: 12, color: C.grey, background: C.bg, borderRadius: 999, padding: '3px 10px' }}>
                {cur.levelText} · {cur.area}
              </span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: C.body, margin: 0 }}>{cur.desc}</p>
          </div>

          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ ...label, marginBottom: 10 }}>BEFORE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {cur.beforeTiles.map((ph) => (
                  <PhotoTile key={ph.id} photo={ph} kind="before"
                    onRemove={canAttend || isAdmin ? (ph.placeholder ? undefined : () => removePhoto(ph.id)) : undefined} />
                ))}
                {cur.beforeTiles.length === 0 && (
                  <div style={{ fontSize: 13, color: C.faint, padding: '8px 0' }}>No photos yet.</div>
                )}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.wash}`, paddingTop: 16 }}>
              <div style={{ ...label, marginBottom: 10 }}>AFTER — COMPLETION</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {cur.afterTiles.map((ph) => (
                  <PhotoTile key={ph.id} photo={ph} kind="after"
                    onRemove={canAttend ? (ph.placeholder ? undefined : () => removePhoto(ph.id)) : undefined} />
                ))}
                {canAttend && (
                  <PhotoInput capture onFiles={async (files) => {
                    for (const f of files) await addPhoto(cur.id, 'after', f);
                    showToast('After photo added');
                  }}>
                    <span style={{
                      width: 132, height: 98, border: `1.5px dashed ${C.hair}`, borderRadius: 10, background: C.paper,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, color: C.grey, boxSizing: 'border-box',
                    }}>
                      <Camera size={20} strokeWidth={1.75} />
                      <span style={{ fontSize: 11.5, fontWeight: 600 }}>Add after photo</span>
                    </span>
                  </PhotoInput>
                )}
                {!canAttend && cur.afterTiles.length === 0 && (
                  <div style={{ fontSize: 13, color: C.faint, padding: '8px 0' }}>Added when the job is completed.</div>
                )}
              </div>
            </div>
          </div>

          {canAttend && (
            <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15.5, color: C.ink, margin: 0 }}>Attendance &amp; completion</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button style={actBtn(cur.status === 'inprogress')}
                  onClick={() => mark('inprogress', { attendedAt: cur.attendedAt || new Date().toISOString() })}>
                  In progress
                </button>
                <button style={actBtn(cur.status === 'attended')}
                  onClick={() => mark('attended', { attendedAt: new Date().toISOString() })}>
                  Attended
                </button>
                <button style={actBtn(cur.status === 'completed' || cur.status === 'awaiting')} onClick={complete}>
                  Completed
                </button>
                <button style={actBtn(cur.status === 'unable', C.errDark)} onClick={markUnable}>
                  Unable to complete
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...label, textTransform: 'uppercase' }}>Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="What was done, products used, anything the manager should know…"
                  style={{
                    border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 14,
                    color: C.ink, background: C.paper, resize: 'vertical', lineHeight: 1.5, fontFamily: FONT,
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.paper, border: `1px solid ${C.wash}`, borderRadius: 10, padding: '12px 14px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Chargeable job</div>
                  <div style={{ fontSize: 12.5, color: C.grey, marginTop: 2 }}>
                    Chargeable jobs go to Billing and need a Xero invoice number before closing.
                  </div>
                </div>
                <Toggle on={cur.chargeable} disabled={!!cur.invoiceNo} onClick={async () => {
                  if (cur.invoiceNo) { showToast('Already invoiced — cannot change', 'warn'); return; }
                  await patchTicket(cur.id, { chargeable: !cur.chargeable });
                  showToast(cur.chargeable ? 'Marked not chargeable' : 'Marked chargeable — will require an invoice to close');
                }} />
              </div>
            </div>
          )}

          {!canAttend && cur.remarks && (
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ ...label, marginBottom: 8 }}>REMARKS — CLEANING TEAM</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: C.body, margin: 0 }}>{cur.remarks}</p>
            </div>
          )}

          {!isConcierge && cur.notes && (
            <div style={{ ...card, padding: '20px 22px' }}>
              <div style={{ ...label, marginBottom: 8 }}>INTERNAL NOTES — NOT ON RESIDENT REPORTS</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: C.body, margin: 0 }}>{cur.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ ...card, padding: '20px 22px' }}>
            <div style={{ ...label, marginBottom: 14 }}>TIMELINE</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((tr) => (
                <div key={tr.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: `1px solid ${C.bg}` }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: tr.dot, flex: 'none' }} />
                  <span style={{ fontSize: 13, color: C.slate, flex: 1 }}>{tr.label}</span>
                  <span style={{ ...mono, fontSize: 12, color: tr.vc }}>{tr.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={label}>DETAILS</div>
            {[
              ['Building', 'Auro Tower'],
              ['Level / area', `${cur.levelText} · ${cur.area}`],
              ['Category', cur.cat],
              ['Created by', cur.by],
              ['Assigned to', cur.teamText],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, gap: 12 }}>
                <span style={{ color: C.grey, flex: 'none' }}>{k}</span>
                <span style={{ color: C.ink, fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>

          {canBilling && (
            <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={label}>BILLING</div>
                <span style={{
                  display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.06em', ...mono, background: chargeBadge.bg, color: chargeBadge.fg,
                }}>
                  {chargeBadge.t}
                </span>
              </div>
              {cur.chargeable && !cur.invoiceNo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12.5, color: C.grey }}>Xero invoice number — required to close this job.</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={invDraft}
                      onChange={(e) => setInvDraft(e.target.value)}
                      placeholder="e.g. INV-2492"
                      style={{
                        flex: 1, height: 38, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px',
                        ...mono, fontSize: 13, color: C.ink, background: C.paper, minWidth: 0,
                      }}
                    />
                    <button onClick={saveInvoice} style={{
                      height: 38, background: C.ink, color: '#fff', border: 'none', borderRadius: 8,
                      padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                    }}>
                      Record
                    </button>
                  </div>
                </div>
              )}
              {cur.invoiceNo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.greenWash, borderRadius: 8, padding: '10px 12px' }}>
                  <CheckCircle2 size={16} color={C.green} strokeWidth={1.75} />
                  <span style={{ ...mono, fontSize: 12.5, color: C.green }}>{cur.invoiceNo} · RECORDED IN XERO</span>
                </div>
              )}
            </div>
          )}

          <div style={{ ...card, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => go('pdf', cur.id)} style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5,
              fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: FONT,
            }}>
              <FileText size={16} strokeWidth={1.75} />
              Generate PDF report
            </button>
            {showClose && (
              <>
                <button onClick={closeTicket} style={{
                  height: 40, background: closeLocked ? C.bg : C.brand, color: closeLocked ? C.faint : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                  cursor: closeLocked ? 'not-allowed' : 'pointer', fontFamily: FONT,
                }}>
                  {closeLocked ? 'Close ticket — locked' : 'Close ticket'}
                </button>
                {closeLocked && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <Lock size={14} color={C.amber} strokeWidth={1.75} style={{ flex: 'none', marginTop: 2 }} />
                    <span style={{ fontSize: 12, color: C.amber, lineHeight: 1.5 }}>
                      Chargeable — closing is locked until an invoice number is recorded.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

