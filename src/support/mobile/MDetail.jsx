// Mobile ticket / job detail.
// Cleaning role: one-tap status, quick remarks, after photos, mark completed.
// Concierge role: read view with delivery timeline (created → synced →
// delivered → seen) and SMS fallback, per the design's offline states.
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Camera, CheckCircle2, Info, Clock, MessageSquare } from 'lucide-react';
import { C, FONT, fmtStamp, fmtTime } from '../constants';
import { mono, StatusBadge, PhotoTile, DeliveryRow } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const screenPad = { paddingLeft: 20, paddingRight: 20 };
const kicker = { ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, marginBottom: 8 };
const QUICK_REMARKS = ['Removed with solvent', 'Repainted', 'Needs follow-up'];

export default function MDetail({ id, go }) {
  const { session, tickets, enrich, patchTicket, addPhoto, showToast, sync } = useSupport();
  const raw = tickets.find((t) => t.id === id) || tickets[0];
  const [picked, setPicked] = useState([]);
  useEffect(() => { setPicked([]); }, [id]);

  if (!raw) {
    return <div style={{ padding: 40, color: C.grey }}>No ticket found.</div>;
  }
  const t = enrich(raw);
  const isCleaning = session?.role === 'cleaning';
  const active = !['closed'].includes(t.status);
  const canWork = isCleaning && active && !['completed', 'awaiting'].includes(t.status);
  const isDone = ['completed', 'awaiting', 'closed'].includes(t.status);
  const backLabel = isCleaning ? 'Jobs' : 'Tickets';

  const toggleRemark = (r) =>
    setPicked((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const complete = async () => {
    const remarks = [t.remarks, ...picked].filter(Boolean).join(' · ');
    await patchTicket(t.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      attendedAt: t.attendedAt || new Date().toISOString(),
      remarks,
    });
    showToast('Job completed — remarks and photos saved');
  };

  const timeStr = (v) => {
    const time = fmtTime(v);
    return time !== '—' ? time : (v ? fmtStamp(v).split(', ')[1] || fmtStamp(v) : '—');
  };

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 14px' }}>
        <span onClick={() => go(isCleaning ? 'jobs' : 'home')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, color: C.brand, fontWeight: 600, cursor: 'pointer' }}>
          <ChevronLeft size={16} strokeWidth={2} />
          {backLabel}
        </span>
        <span style={{ ...mono, fontSize: 14, fontWeight: 600, color: C.ink }}>{t.ticketNo}</span>
        <StatusBadge status={t.status} style={{ fontSize: 11, padding: '4px 10px' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.greenWash, borderRadius: 14, padding: '14px 16px' }}>
            <CheckCircle2 size={22} color={C.green} strokeWidth={2} style={{ flex: 'none' }} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Job completed</div>
              <div style={{ ...mono, fontSize: 10.5, color: C.green, marginTop: 2 }}>
                {t.attendedAt ? `ATTENDED ${timeStr(t.attendedAt)} · ` : ''}COMPLETED {timeStr(t.completedAt)}
              </div>
            </div>
          </div>
        )}

        <div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: C.ink }}>
            {t.cat} — {t.area}
          </div>
          <div style={{ ...mono, fontSize: 11, color: C.grey, marginTop: 3 }}>
            {t.levelText} · {t.prio.toUpperCase()} PRIORITY · {(t.by || '').split(' ·')[0].toUpperCase()}
          </div>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.55, color: C.slate, margin: 0 }}>{t.desc}</p>

        {/* Concierge delivery state for tickets waiting on an offline cleaner */}
        {!isCleaning && t.status === 'assigned' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: C.amberWash, borderRadius: 14, padding: '14px 16px' }}>
              <Clock size={20} color={C.amber} strokeWidth={1.75} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Not delivered yet</div>
                <div style={{ fontSize: 13, color: C.amberDeep, lineHeight: 1.5, marginTop: 3 }}>
                  {t.synced === false
                    ? "This phone is offline. The ticket will send itself automatically when you're back in reception."
                    : "The assigned phone is offline. The ticket will reach them automatically when they reconnect — you'll see it here."}
                </div>
              </div>
            </div>
            <div>
              <div style={kicker}>DELIVERY</div>
              <div style={{ border: `1px solid ${C.wash}`, borderRadius: 14, padding: '4px 14px' }}>
                <DeliveryRow done label="Created" time={timeStr(t.created)} />
                <DeliveryRow done={t.synced !== false} waiting={t.synced === false}
                  label="Synced to server" time={t.synced === false ? 'WAITING…' : timeStr(t.created)} />
                <DeliveryRow waiting={t.synced !== false} label={`Delivered to ${((t.team || 'the team').split('—')[0] || '').trim()}`}
                  time={t.synced === false ? '—' : 'WAITING…'} />
                <DeliveryRow label="Seen by cleaner" time="—" />
              </div>
            </div>
          </>
        )}

        {t.beforeTiles.length > 0 && (
          <div>
            <div style={kicker}>BEFORE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {t.beforeTiles.map((ph) => (
                <PhotoTile key={ph.id} photo={ph} kind="before" width="100%" height={96} radius={12} />
              ))}
            </div>
          </div>
        )}

        {t.afterTiles.length > 0 && (
          <div>
            <div style={kicker}>AFTER</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {t.afterTiles.map((ph) => (
                <PhotoTile key={ph.id} photo={ph} kind="after" width="100%" height={96} radius={12} />
              ))}
            </div>
          </div>
        )}

        {canWork && (
          <div>
            <div style={kicker}>QUICK REMARKS — TAP TO ADD</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_REMARKS.map((r) => {
                const on = picked.includes(r);
                return (
                  <button key={r} onClick={() => toggleRemark(r)} style={{
                    height: 38, padding: '0 13px', borderRadius: 999,
                    border: on ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
                    background: on ? C.ink : '#fff', fontSize: 13, fontWeight: on ? 600 : 400,
                    color: on ? '#fff' : C.slate, cursor: 'pointer', fontFamily: FONT,
                  }}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isDone && t.remarks && (
          <div style={{ border: `1px solid ${C.wash}`, borderRadius: 12, padding: '13px 14px' }}>
            <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.1em', color: C.faint }}>REMARKS</div>
            <div style={{ fontSize: 14, color: C.body, marginTop: 4, lineHeight: 1.5 }}>{t.remarks}</div>
          </div>
        )}

        {isDone && isCleaning && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: C.paper, border: `1px solid ${C.wash}`, borderRadius: 12, padding: '12px 14px' }}>
            <Info size={16} color={C.grey} strokeWidth={1.75} style={{ flex: 'none', marginTop: 1 }} />
            <span style={{ fontSize: 13, color: C.slate, lineHeight: 1.5 }}>
              All done — your admin takes it from here. Billing and closing are handled on the dashboard.
            </span>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {canWork && (
          <>
            <label style={{
              height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#fff', border: `1.5px dashed ${C.hair}`, borderRadius: 13,
              fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.ink, cursor: 'pointer',
            }}>
              <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) await addPhoto(t.id, 'after', file);
                  if (files.length) showToast('After photo added');
                  e.target.value = '';
                }} />
              <Camera size={19} color={C.brand} strokeWidth={1.75} />
              Add after photo
            </label>
            <button onClick={complete} style={{
              height: 56, background: C.brand, color: '#fff', border: 'none', borderRadius: 14,
              fontFamily: FONT, fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              Mark completed
            </button>
          </>
        )}
        {!isCleaning && t.status === 'assigned' && (
          <>
            <a
              href={`sms:?&body=${encodeURIComponent(`${t.ticketNo} — ${t.cat} at ${t.levelText} · ${t.area}. ${t.desc}`)}`}
              style={{
                height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: '#fff', border: `1px solid ${C.line}`, borderRadius: 13,
                fontFamily: FONT, fontSize: 15, fontWeight: 600, color: C.ink, textDecoration: 'none',
              }}
            >
              <MessageSquare size={18} color={C.grey} strokeWidth={1.75} style={{ flex: 'none' }} />
              Send via SMS instead
            </a>
            <button
              onClick={() => showToast(sync.online
                ? "You'll be notified when it's delivered"
                : 'Saved — delivery updates will appear when back online')}
              style={{
                height: 52, background: C.ink, color: '#fff', border: 'none', borderRadius: 13,
                fontFamily: FONT, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Notify me when delivered
            </button>
          </>
        )}
        {(isDone || (!canWork && isCleaning) || (!isCleaning && t.status !== 'assigned')) && (
          <button onClick={() => go(isCleaning ? 'jobs' : 'home')} style={{
            height: 54, background: C.ink, color: '#fff', border: 'none', borderRadius: 14,
            fontFamily: FONT, fontSize: 15.5, fontWeight: 700, cursor: 'pointer',
          }}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
