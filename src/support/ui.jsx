/* eslint-disable react-refresh/only-export-components */
// Shared UI primitives for the support app — status badges, chips, toggles,
// toast, sync pill, photo tiles. Inline styles mirror the design handoff.
import React, { useEffect, useState } from 'react';
import {
  Check, CheckCheck, Clock, RefreshCw, CloudOff, Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import { C, FONT, badgeStyle, STATUSES } from './constants';
import { useSupport } from './store.jsx';

export const mono = {
  fontFamily: FONT,
  fontVariantNumeric: 'tabular-nums',
};

export function kicker(extra = {}) {
  return {
    ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint, ...extra,
  };
}

export function StatusBadge({ status, style }) {
  const st = STATUSES[status] || STATUSES.open;
  return <span style={{ ...badgeStyle(status), ...style }}>{st.l}</span>;
}

// Calm list treatment — a small colored dot with plain text, for tables and
// dense lists where full pill badges read as noise.
export function StatusText({ status, style }) {
  const st = STATUSES[status] || STATUSES.open;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.slate, whiteSpace: 'nowrap', ...style }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.fg, flex: 'none', opacity: 0.85 }} />
      {st.l}
    </span>
  );
}

export function PrioDot({ color, label, style }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color, ...style }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} />
      {label}
    </span>
  );
}

export function Chip({ active, children, onClick, dashed, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 32, padding: '0 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer', fontFamily: FONT,
        border: dashed ? `1.5px dashed ${C.hair}` : active ? `1px solid ${C.ink}` : `1px solid ${C.line}`,
        background: dashed ? C.paper : active ? C.ink : '#fff',
        color: dashed ? C.grey : active ? '#fff' : C.slate,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Seg({ active, children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 30, padding: '0 13px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
        cursor: 'pointer', border: 'none', fontFamily: FONT,
        background: active ? C.ink : 'transparent', color: active ? '#fff' : C.grey,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 40, height: 23, borderRadius: 999, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', flex: 'none',
        background: on ? C.brand : C.line, opacity: disabled ? 0.5 : 1, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 20 : 3, width: 17, height: 17,
        borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease-out', display: 'block',
      }} />
    </button>
  );
}

export function Toast() {
  const { toast } = useSupport();
  if (!toast) return null;
  const dot = { ok: C.green, err: C.err, warn: C.amber }[toast.kind] || C.green;
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)',
      background: C.ink, color: '#fff', borderRadius: 10, padding: '12px 18px',
      fontSize: 13.5, fontWeight: 500, boxShadow: '0 10px 30px rgba(14,15,17,0.3)',
      display: 'flex', alignItems: 'center', gap: 10, zIndex: 100, fontFamily: FONT,
      maxWidth: '90vw',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none' }} />
      {toast.msg}
    </div>
  );
}

// SYNCED / OFFLINE / QUEUED pill — used on both mobile and desktop headers.
export function SyncPill({ compact }) {
  const { sync, session, syncNow } = useSupport();
  const demo = session?.mode === 'demo';
  const offline = !sync.online;
  const queued = sync.pending > 0;
  const color = offline || queued ? C.amber : C.green;
  const bg = offline || queued ? C.amberWash : C.greenWash;
  let text = 'SYNCED';
  if (demo) text = 'DEMO · ON DEVICE';
  else if (offline) text = queued ? `OFFLINE · ${sync.pending} QUEUED` : 'OFFLINE';
  else if (sync.syncing) text = 'SYNCING…';
  else if (queued) text = `${sync.pending} QUEUED`;
  return (
    <button
      onClick={() => !demo && syncNow()}
      title={demo ? 'Demo mode — data stays on this device' : 'Tap to sync now'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: demo ? C.wash : bg,
        borderRadius: 999, padding: compact ? '5px 11px' : '6px 12px', border: 'none', cursor: 'pointer',
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: demo ? C.grey : color }} />
      <span style={{ ...mono, fontSize: 9.5, letterSpacing: '0.08em', color: demo ? C.slate : color }}>
        {text}
      </span>
      {sync.syncing && <RefreshCw size={10} color={color} style={{ animation: 'spin 1s linear infinite' }} />}
    </button>
  );
}

// Photo tile — renders a real photo if one exists locally/remotely, else the
// design's grey placeholder gradient.
export function PhotoTile({ photo, kind = 'before', width = 132, height = 98, radius = 10, onRemove }) {
  const { loadPhotoUrl } = useSupport();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let on = true;
    if (photo && !photo.placeholder) {
      loadPhotoUrl(photo.id).then((u) => on && setUrl(u));
    }
    return () => { on = false; };
  }, [photo, loadPhotoUrl]);

  const after = kind === 'after';
  const bg = after
    ? 'linear-gradient(135deg,#E7F6EF,#C7E8D8)'
    : 'linear-gradient(135deg,#DBE0E6,#C2C9D1)';
  return (
    <div style={{
      width, height, borderRadius: radius, background: bg, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      flex: 'none',
    }}>
      {url ? (
        <img src={url} alt={photo?.name || ''} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <ImageIcon size={20} color={after ? C.green : C.grey} strokeWidth={1.75} />
      )}
      {photo?.name && !url && (
        <span style={{ position: 'absolute', left: 8, bottom: 6, ...mono, fontSize: 9, color: after ? C.green : C.slate }}>
          {photo.name}
        </span>
      )}
      {photo && !photo.placeholder && !photo.uploaded && !url?.startsWith('http') && (
        <span style={{
          position: 'absolute', right: 6, top: 6, background: 'rgba(14,15,17,0.55)', color: '#fff',
          borderRadius: 999, padding: '2px 7px', ...mono, fontSize: 8, letterSpacing: '0.06em',
        }}>
          ON DEVICE
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Remove photo"
          style={{
            position: 'absolute', right: 6, bottom: 6, width: 22, height: 22, borderRadius: '50%',
            border: 'none', background: 'rgba(14,15,17,0.6)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// Hidden file input helper for photo capture/upload.
export function PhotoInput({ onFiles, capture, children, style }) {
  const id = React.useId();
  return (
    <label htmlFor={id} style={{ cursor: 'pointer', ...style }}>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      {children}
    </label>
  );
}

export function DeliveryRow({ done, waiting, label, time }) {
  const icon = done ? <CheckCheck size={16} color={C.green} strokeWidth={2} />
    : waiting ? <Clock size={16} color={C.amber} strokeWidth={2} />
    : <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${C.hair}` }} />
      </span>;
  const fg = done ? C.ink : waiting ? C.amber : C.faint;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.bg}` }}>
      <span style={{ flex: 'none', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: done || waiting ? 600 : 500, color: fg }}>{label}</span>
      <span style={{ ...mono, fontSize: 11, color: waiting ? C.amber : done ? C.faint : C.hair }}>{time}</span>
    </div>
  );
}

export { Check, CloudOff, AlertTriangle };

// keyframes used by SyncPill spinner + fades — injected once.
export function GlobalSupportStyles() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes bstFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes bstToast { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      .support-app input:focus, .support-app select:focus, .support-app textarea:focus {
        outline: none; border-color: #DE192A !important; box-shadow: 0 0 0 3px rgba(222,25,42,0.16);
      }
      .support-app ::-webkit-scrollbar { width: 8px; height: 8px; }
      .support-app ::-webkit-scrollbar-thumb { background: #DBE0E6; border-radius: 99px; }
    `}</style>
  );
}
