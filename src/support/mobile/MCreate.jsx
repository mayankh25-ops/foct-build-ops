// Mobile create-ticket wizard — 2 steps, tap only, then success screen.
// Step 1: where & what (level grid, area chips, issue grid).
// Step 2: priority, photos, quick note. Submit works offline (queued).
import React, { useState, useRef } from 'react';
import {
  Camera, ChevronDown, ChevronLeft, Check, CheckCheck, Mic, MessageSquare,
  MessageCircle, Mail, Building2, Cloud,
} from 'lucide-react';
import { C, FONT, DEFAULT_LEVELS, PRIORITY_ACCENT, levelText, TEAMS } from '../constants';
import { mono } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const screenPad = { paddingLeft: 20, paddingRight: 20 };
const QUICK_LEVELS = ['B2', 'G', 'L7', 'L23'];
const QUICK_NOTES = ['Near lift bank B', 'Recurring issue', 'Blocking access'];

const kicker = { ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, marginBottom: 8 };

export default function MCreate({ go }) {
  const { companies, session, createTicket, showToast, sync } = useSupport();
  const site = companies[0]?.sites?.[0];
  const areas = (site?.areas || []).slice(0, 5);
  const issues = site?.issues || [];
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(null); // created ticket -> success screen
  const [f, setF] = useState({
    level: '', area: '', customArea: '', showCustom: false, category: '',
    priority: 'Medium', note: '', quick: [], photos: [], assign: TEAMS[0],
  });
  const [showAllLevels, setShowAllLevels] = useState(false);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const offline = !sync.online && session?.mode === 'live';

  const submit = async () => {
    if (!f.level || !f.category) {
      showToast('Pick a level and an issue first', 'err');
      setStep(1);
      return;
    }
    const quick = f.quick.join(' · ');
    const desc = [quick, f.note.trim()].filter(Boolean).join(' — ') || `${f.category} reported at ${f.area || 'common area'}`;
    const t = await createTicket({
      level: f.level,
      area: f.showCustom ? (f.customArea || 'Custom area') : (f.area || 'Common area'),
      category: f.category,
      priority: f.priority,
      desc,
      assign: f.assign,
      photos: f.photos,
    });
    setDone(t);
  };

  // ------- success / offline-saved screen -------
  if (done) {
    const shareText = `${done.ticketNo} — ${done.cat} at ${levelText(done.level)} · ${done.area}. Priority: ${done.prio}.`;
    return (
      <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {offline && (
          <div style={{ margin: '-18px -20px 0', background: C.amberWash, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cloud size={14} color={C.amber} strokeWidth={1.75} />
            <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: C.amber }}>
              WORKING OFFLINE — 1 TICKET QUEUED
            </span>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 4px' }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: offline ? C.amberWash : C.greenWash,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
          }}>
            {offline
              ? <Cloud size={36} color={C.amber} strokeWidth={1.75} />
              : <Check size={40} color={C.green} strokeWidth={2} />}
          </div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, letterSpacing: '-0.02em', color: C.ink }}>
            {offline ? 'Saved offline' : 'Ticket created'}
          </div>
          <div style={{ ...mono, fontSize: 15, color: offline ? C.amber : C.brand, marginTop: 8 }}>
            {done.ticketNo}{offline ? ' · QUEUED' : ''}
          </div>
          {offline && (
            <p style={{ fontSize: 14, color: C.grey, lineHeight: 1.55, margin: '14px 0 0' }}>
              The ticket and {done.nb} photo{done.nb === 1 ? '' : 's'} are stored on this phone. They will sync
              automatically as soon as you are back online — nothing else to do.
            </p>
          )}
          <div style={{ width: '100%', marginTop: 26, border: `1px solid ${offline ? C.amberLine : C.wash}`, background: offline ? C.amberBg : '#fff', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', boxSizing: 'border-box' }}>
            <SummaryRow k="Issue" v={<>{done.cat} · <span style={{ color: PRIORITY_ACCENT[done.prio]?.active || C.slate }}>{done.prio}</span></>} />
            <SummaryRow k="Where" v={`${levelText(done.level)} · ${done.area}`} />
            <SummaryRow k="Photos" v={`${done.nb} attached`} />
          </div>
          {!offline && done.team && (
            <div style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${C.greenLine}`, background: C.greenBg, borderRadius: 14, padding: '13px 16px', textAlign: 'left', boxSizing: 'border-box' }}>
              <CheckCheck size={20} color={C.green} strokeWidth={2} style={{ flex: 'none' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Sent to {done.team}</div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: '0.05em', color: C.green, marginTop: 2 }}>
                  APPEARS IN THEIR QUEUE THE MOMENT THEY'RE ONLINE
                </div>
              </div>
            </div>
          )}
          <div style={{ width: '100%', marginTop: 16, textAlign: 'left' }}>
            <div style={kicker}>SHARE TICKET</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <ShareBtn icon={<MessageSquare size={16} color={C.grey} strokeWidth={1.75} />} label="SMS"
                href={`sms:?&body=${encodeURIComponent(shareText)}`} />
              <ShareBtn icon={<MessageCircle size={16} color={C.green} strokeWidth={1.75} />} label="WhatsApp"
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} />
              <ShareBtn icon={<Mail size={16} color={C.grey} strokeWidth={1.75} />} label="Email"
                href={`mailto:?subject=${encodeURIComponent(done.ticketNo + ' — ' + done.cat)}&body=${encodeURIComponent(shareText)}`} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => go('detail', done.id)} style={bigBtn(C.ink)}>View ticket</button>
          <button onClick={() => go('home')} style={bigBtnOutline}>Done</button>
        </div>
      </div>
    );
  }

  // ------- step 1: where & what -------
  if (step === 1) {
    return (
      <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <WizardHeader
          left={<span onClick={() => go('home')} style={{ fontSize: 15, color: C.brand, fontWeight: 600, cursor: 'pointer' }}>Cancel</span>}
          step="1 / 2"
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, borderRadius: 12, padding: '12px 14px' }}>
            <Building2 size={18} color={C.ink} strokeWidth={1.75} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, flex: 1 }}>{site?.name || 'Auro Tower'}</span>
            <Check size={16} color={C.green} strokeWidth={2} />
          </div>

          <div>
            <div style={kicker}>LEVEL</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {QUICK_LEVELS.map((lv) => (
                <button key={lv} onClick={() => set({ level: lv })} style={{
                  height: 46, borderRadius: 11,
                  border: f.level === lv ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
                  background: f.level === lv ? C.ink : '#fff',
                  ...mono, fontSize: 13, color: f.level === lv ? '#fff' : C.slate, cursor: 'pointer',
                }}>
                  {lv}
                </button>
              ))}
            </div>
            {showAllLevels ? (
              <select
                value={f.level}
                onChange={(e) => { set({ level: e.target.value }); setShowAllLevels(false); }}
                autoFocus
                style={{
                  marginTop: 8, width: '100%', height: 44, borderRadius: 11, border: `1px solid ${C.line}`,
                  background: '#fff', fontSize: 14, color: C.ink, padding: '0 10px', fontFamily: FONT,
                }}
              >
                <option value="">Select level…</option>
                {DEFAULT_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : (
              <button onClick={() => setShowAllLevels(true)} style={{
                marginTop: 8, width: '100%', height: 44, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '0 14px', borderRadius: 11,
                border: `1px solid ${C.line}`, background: C.paper, fontSize: 13.5,
                color: !QUICK_LEVELS.includes(f.level) && f.level ? C.ink : C.slate,
                fontWeight: !QUICK_LEVELS.includes(f.level) && f.level ? 600 : 400,
                cursor: 'pointer', fontFamily: FONT, boxSizing: 'border-box',
              }}>
                {!QUICK_LEVELS.includes(f.level) && f.level ? `Level ${f.level}` : 'All levels — B2 to L86'}
                <ChevronDown size={15} color={C.faint} strokeWidth={2} />
              </button>
            )}
          </div>

          <div>
            <div style={kicker}>AREA</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {areas.map((a) => (
                <button key={a} onClick={() => set({ area: a, showCustom: false })} style={pill(f.area === a && !f.showCustom)}>
                  {a}
                </button>
              ))}
              <button onClick={() => set({ showCustom: !f.showCustom, area: '' })} style={{
                ...pill(false), border: `1.5px dashed ${C.hair}`, background: C.paper, color: C.grey,
              }}>
                Custom…
              </button>
            </div>
            {f.showCustom && (
              <input
                value={f.customArea}
                onChange={(e) => set({ customArea: e.target.value })}
                placeholder="Type the area…"
                style={{
                  marginTop: 8, width: '100%', height: 44, border: `1px solid ${C.line}`, borderRadius: 11,
                  padding: '0 14px', fontSize: 14, color: C.ink, background: C.paper, fontFamily: FONT,
                  boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          <div>
            <div style={kicker}>ISSUE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {issues.map((c) => {
                const on = f.category === c;
                return (
                  <button key={c} onClick={() => set({ category: c })} style={{
                    height: 44, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px',
                    borderRadius: 11,
                    border: on ? `1.5px solid ${C.brand}` : `1px solid ${C.line}`,
                    background: on ? C.brandWash : '#fff',
                    fontSize: 13.5, fontWeight: on ? 600 : 500,
                    color: on ? C.ink : C.slate, cursor: 'pointer', fontFamily: FONT,
                    textAlign: 'left',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flex: 'none',
                      background: on ? C.brand : C.hair,
                    }} />
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (!f.level || !f.category) { showToast('Pick a level and an issue first', 'err'); return; }
            setStep(2);
          }}
          style={{ ...bigBtn(C.brand), marginTop: 14 }}
        >
          Continue
        </button>
      </div>
    );
  }

  // ------- step 2: photo & submit -------
  return (
    <Step2 f={f} set={set} go={go} setStep={setStep} submit={submit} />
  );
}

function Step2({ f, set, setStep, submit }) {
  const { showToast } = useSupport();
  const [busy, setBusy] = useState(false);
  const [failedIdx, setFailedIdx] = useState(null); // simulated per-photo failure surface
  const recogRef = useRef(null);

  const record = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice notes need a supported phone browser', 'warn'); return; }
    if (recogRef.current) { recogRef.current.stop(); recogRef.current = null; return; }
    const r = new SR();
    r.lang = 'en-AU';
    r.onresult = (e) => {
      const said = Array.from(e.results).map((res) => res[0].transcript).join(' ');
      set({ note: (f.note ? f.note + ' ' : '') + said });
    };
    r.onend = () => { recogRef.current = null; };
    r.start();
    recogRef.current = r;
    showToast('Listening — speak your note');
  };

  return (
    <div style={{ ...screenPad, paddingTop: 18, paddingBottom: 34, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <WizardHeader
        left={
          <span onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, color: C.brand, fontWeight: 600, cursor: 'pointer' }}>
            <ChevronLeft size={16} strokeWidth={2} />
            Back
          </span>
        }
        step="2 / 2"
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
          <span style={{ ...mono, fontSize: 11, color: C.ink }}>
            {levelText(f.level)} · {(f.showCustom ? f.customArea : f.area || 'COMMON AREA').toUpperCase()}
          </span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.hair }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.brand }}>{f.category}</span>
          <span onClick={() => setStep(1)} style={{ marginLeft: 'auto', fontSize: 12.5, color: C.grey, cursor: 'pointer' }}>Edit</span>
        </div>

        <div>
          <div style={kicker}>PRIORITY</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, background: C.bg, borderRadius: 11, padding: 4 }}>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => {
              const acc = PRIORITY_ACCENT[p];
              const on = f.priority === p;
              return (
                <button key={p} onClick={() => set({ priority: p })} style={{
                  height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: 'none', borderRadius: 8, background: on ? acc.active : 'transparent',
                  fontSize: 13, fontWeight: on ? 700 : 600, color: on ? '#fff' : acc.active,
                  cursor: 'pointer', fontFamily: FONT,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? 'rgba(255,255,255,0.9)' : acc.dot, flex: 'none' }} />
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={kicker}>PHOTOS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{
              height: 112, border: `1.5px dashed ${C.hair}`, borderRadius: 14, background: C.paper,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer', color: C.ink, boxSizing: 'border-box',
            }}>
              <input
                type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) set({ photos: [...f.photos, ...files] });
                  e.target.value = '';
                }}
              />
              <Camera size={26} color={C.brand} strokeWidth={1.75} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Take photo</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.photos.slice(0, 2).map((file, i) => (
                <MobilePhotoThumb key={i} file={file} failed={failedIdx === i}
                  onRetry={() => setFailedIdx(null)}
                  onRemove={() => { set({ photos: f.photos.filter((_, j) => j !== i) }); setFailedIdx(null); }} />
              ))}
              {f.photos.length === 0 && (
                <div style={{
                  flex: 1, borderRadius: 12, border: `1px dashed ${C.wash}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...mono, fontSize: 9, letterSpacing: '0.08em', color: C.faint, minHeight: 112,
                }}>
                  PHOTOS APPEAR HERE
                </div>
              )}
            </div>
          </div>
          {f.photos.length > 2 && (
            <div style={{ ...mono, fontSize: 10, color: C.grey, marginTop: 6 }}>
              +{f.photos.length - 2} more attached
            </div>
          )}
        </div>

        <div>
          <div style={kicker}>QUICK NOTE — TAP TO ADD OR RECORD</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_NOTES.map((n) => {
              const on = f.quick.includes(n);
              return (
                <button key={n} onClick={() => set({ quick: on ? f.quick.filter((x) => x !== n) : [...f.quick, n] })}
                  style={{
                    height: 38, padding: '0 13px', borderRadius: 999,
                    border: on ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
                    background: on ? C.ink : '#fff', fontSize: 13, fontWeight: on ? 600 : 400,
                    color: on ? '#fff' : C.slate, cursor: 'pointer', fontFamily: FONT,
                  }}>
                  {n}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input
              value={f.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Add a note… (optional)"
              style={{
                flex: 1, height: 44, border: `1px solid ${C.wash}`, borderRadius: 11, padding: '0 14px',
                background: C.paper, fontSize: 13.5, color: C.ink, fontFamily: FONT, minWidth: 0,
              }}
            />
            <button onClick={record} aria-label="Record a voice note" style={{
              width: 44, height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${C.brand}`, borderRadius: 11, background: C.brandWash, cursor: 'pointer',
            }}>
              <Mic size={20} color={C.brand} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); try { await submit(); } finally { setBusy(false); } }}
          style={{ ...bigBtn(C.brand), opacity: busy ? 0.7 : 1 }}
        >
          {busy ? 'Saving…' : 'Submit ticket'}
        </button>
        <div style={{ textAlign: 'center', ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: C.faint, marginTop: 8 }}>
          WORKS OFFLINE — SYNCS AUTOMATICALLY
        </div>
      </div>
    </div>
  );
}

function MobilePhotoThumb({ file, failed, onRetry, onRemove }) {
  const [url, setUrl] = useState(null);
  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (failed) {
    return (
      <div style={{
        minHeight: 51, flex: 1, border: `1.5px solid ${C.err}`, borderRadius: 12, background: C.errWash,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.errDeep }}>Upload failed</span>
        <button onClick={onRetry} style={{
          height: 26, padding: '0 12px', borderRadius: 999, border: `1px solid ${C.errDark}`,
          background: '#fff', fontSize: 11, fontWeight: 600, color: C.errDark, cursor: 'pointer', fontFamily: FONT,
        }}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div style={{
      flex: 1, minHeight: 51, borderRadius: 12, background: 'linear-gradient(135deg,#DBE0E6,#C2C9D1)',
      position: 'relative', overflow: 'hidden',
    }}>
      {url && <img src={url} alt={file.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', left: 8, bottom: 5, ...mono, fontSize: 8.5, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
        {file.name}
      </span>
      <button onClick={onRemove} aria-label="Remove photo" style={{
        position: 'absolute', right: 5, top: 5, width: 20, height: 20, borderRadius: '50%', border: 'none',
        background: 'rgba(14,15,17,0.6)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

function WizardHeader({ left, step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 14px' }}>
      {left}
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 16, color: C.ink }}>New ticket</span>
      <span style={{ ...mono, fontSize: 11, color: C.faint }}>{step}</span>
    </div>
  );
}

function SummaryRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
      <span style={{ color: C.grey }}>{k}</span>
      <span style={{ fontWeight: 600, color: C.ink }}>{v}</span>
    </div>
  );
}

function ShareBtn({ icon, label, href }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" style={{
      height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      background: '#fff', border: `1px solid ${C.line}`, borderRadius: 11, fontSize: 13,
      fontWeight: 600, color: C.ink, textDecoration: 'none', fontFamily: FONT,
    }}>
      {icon}
      {label}
    </a>
  );
}

function pill(active) {
  return {
    height: 40, padding: '0 14px', borderRadius: 999,
    border: active ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
    background: active ? C.ink : '#fff', fontSize: 13.5,
    fontWeight: active ? 600 : 400, color: active ? '#fff' : C.slate,
    cursor: 'pointer', fontFamily: FONT,
  };
}

const bigBtn = (bg) => ({
  width: '100%', height: 56, background: bg, color: '#fff', border: 'none', borderRadius: 14,
  fontFamily: FONT, fontSize: 16, fontWeight: 700, cursor: 'pointer',
});
const bigBtnOutline = {
  width: '100%', height: 54, background: '#fff', color: C.ink, border: `1px solid ${C.line}`,
  borderRadius: 14, fontFamily: FONT, fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
};
