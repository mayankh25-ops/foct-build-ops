// Create ticket — form (building, level, area chips, category chips, priority,
// description, photos, assign) + "what happens next" / offline-ready side rail.
import React, { useState } from 'react';
import { AlertTriangle, Camera } from 'lucide-react';
import { C, FONT, DEFAULT_LEVELS, TEAMS, SITE_NAME, SITE_ADDR } from '../constants';
import { mono, Chip, Seg, PhotoInput } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const label = { ...mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.grey };
const selectS = {
  height: 42, border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff',
  fontSize: 14, color: C.ink, padding: '0 10px', cursor: 'pointer', fontFamily: FONT,
};

export default function CreateTicket({ go }) {
  const { companies, createTicket, showToast, sync, session } = useSupport();
  const site = companies[0]?.sites?.[0];
  const areas = site?.areas || [];
  const issues = site?.issues || [];
  const [form, setForm] = useState({
    level: '', area: '', customArea: '', showCustom: false, category: '',
    priority: 'Medium', desc: '', assign: TEAMS[0], photos: [],
  });
  const [err, setErr] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.level || !form.category || !form.desc.trim()) {
      setErr(true);
      showToast('Complete the highlighted fields', 'err');
      return;
    }
    const area = form.showCustom ? (form.customArea || 'Custom area') : (form.area || 'Common area');
    const t = await createTicket({ ...form, area });
    const offline = !sync.online && session?.mode === 'live';
    showToast(offline
      ? `${t.ticketNo} saved offline — will sync when connected`
      : `${t.ticketNo} created and assigned to ${t.team || 'triage'}`,
      offline ? 'warn' : 'ok');
    go('tickets');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,720px) 300px', gap: 22, animation: 'bstFade 0.3s ease-out' }}>
      <div style={{
        background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12,
        boxShadow: '0 1px 2px rgba(14,15,17,0.04)', padding: '26px 28px',
        display: 'flex', flexDirection: 'column', gap: 22,
      }}>
        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.errWash, border: `1px solid ${C.errLine}`, borderRadius: 10, padding: '12px 14px' }}>
            <AlertTriangle size={17} color={C.errDark} strokeWidth={1.75} style={{ flex: 'none' }} />
            <span style={{ fontSize: 13.5, color: C.errDeep }}>
              Complete the highlighted fields — level, category and a short description are required.
            </span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Building</label>
            <select style={selectS}>
              <option>{SITE_NAME} — {SITE_ADDR}</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Level</label>
            <select
              value={form.level}
              onChange={(e) => { set({ level: e.target.value }); setErr(false); }}
              style={{ ...selectS, border: err && !form.level ? `1px solid ${C.err}` : selectS.border }}
            >
              <option value="">Select level…</option>
              {DEFAULT_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={label}>Area</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {areas.map((a) => (
              <Chip key={a} active={form.area === a && !form.showCustom}
                onClick={() => set({ area: a, showCustom: false })}>{a}</Chip>
            ))}
            <Chip dashed active={form.showCustom} onClick={() => set({ showCustom: !form.showCustom, area: '' })}>
              Custom…
            </Chip>
          </div>
          {form.showCustom && (
            <input
              value={form.customArea}
              onChange={(e) => set({ customArea: e.target.value })}
              placeholder="Type the area, e.g. Sky lounge west"
              style={{
                height: 40, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px',
                fontSize: 14, color: C.ink, background: C.paper, maxWidth: 340, fontFamily: FONT,
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ ...label, color: err && !form.category ? C.err : label.color }}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {issues.map((c) => (
              <Chip key={c} active={form.category === c} onClick={() => { set({ category: c }); setErr(false); }}>{c}</Chip>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={label}>Priority</label>
          <div style={{ display: 'inline-flex', gap: 4, background: C.bg, border: `1px solid ${C.wash}`, borderRadius: 9, padding: 4, alignSelf: 'flex-start' }}>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <Seg key={p} active={form.priority === p} onClick={() => set({ priority: p })}>{p}</Seg>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={label}>Short description</label>
          <textarea
            value={form.desc}
            onChange={(e) => { set({ desc: e.target.value }); }}
            rows={3}
            placeholder="What happened, and where exactly? e.g. Black marker tags on the east wall beside lift bank B."
            style={{
              border: err && !form.desc.trim() ? `1px solid ${C.err}` : `1px solid ${C.line}`,
              borderRadius: 8, padding: '10px 12px', fontSize: 14, color: C.ink, background: C.paper,
              resize: 'vertical', lineHeight: 1.5, fontFamily: FONT,
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={label}>Photos</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {form.photos.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <LocalPhotoPreview file={f} onRemove={() => set({ photos: form.photos.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <PhotoInput onFiles={(files) => set({ photos: [...form.photos, ...files] })}>
              <span style={{
                width: 118, height: 88, border: `1.5px dashed ${C.hair}`, borderRadius: 10, background: C.paper,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: C.grey, boxSizing: 'border-box',
              }}>
                <Camera size={20} strokeWidth={1.75} />
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>Add photo</span>
              </span>
            </PhotoInput>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Assign to</label>
            <select value={form.assign} onChange={(e) => set({ assign: e.target.value })} style={selectS}>
              {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6, borderTop: `1px solid ${C.wash}` }}>
          <button onClick={() => go('dashboard')} style={{
            height: 42, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 18px',
            fontSize: 14, fontWeight: 600, color: C.ink, cursor: 'pointer', fontFamily: FONT,
          }}>
            Cancel
          </button>
          <button onClick={submit} style={{
            height: 42, background: C.brand, color: '#fff', border: 'none', borderRadius: 8, padding: '0 20px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
          }}>
            Create ticket
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: C.ink, borderRadius: 12, padding: 20, color: '#fff' }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, marginBottom: 12 }}>WHAT HAPPENS NEXT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'The assigned team is notified and the ticket appears in their queue.',
              'Attendance is timestamped; before and after photos are attached.',
              'You can follow status live and export a PDF report at any time.',
            ].map((txt, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <span style={{ ...mono, fontSize: 11, color: C.brand }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 13, color: C.hair, lineHeight: 1.5 }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.grey, marginBottom: 8 }}>OFFLINE READY</div>
          <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.55, margin: 0 }}>
            No signal in the car park? The ticket and photos save to this device and sync
            automatically when you are back online.
          </p>
        </div>
      </div>
    </div>
  );
}

// Preview a not-yet-saved File straight from memory.
function LocalPhotoPreview({ file, onRemove }) {
  const [url, setUrl] = useState(null);
  React.useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div style={{
      width: 118, height: 88, borderRadius: 10, overflow: 'hidden', position: 'relative',
      background: 'linear-gradient(135deg,#DBE0E6,#C2C9D1)', flex: 'none',
    }}>
      {url && <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <span style={{ position: 'absolute', left: 8, bottom: 6, ...mono, fontSize: 9, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
        {file.name}
      </span>
      <button onClick={onRemove} aria-label="Remove photo" style={{
        position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: '50%',
        border: 'none', background: 'rgba(14,15,17,0.6)', color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1,
      }}>×</button>
    </div>
  );
}
