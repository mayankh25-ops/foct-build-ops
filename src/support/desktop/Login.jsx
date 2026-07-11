// Sign-in screen — dark brand panel + form + demo role picker (per design).
import React, { useState } from 'react';
import { User, SprayCan, BarChart3 } from 'lucide-react';
import { C, FONT } from '../constants';
import { mono } from '../ui.jsx';
import { useSupport } from '../store.jsx';

const label = { ...mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.grey, marginBottom: 6, display: 'block' };
const input = {
  width: '100%', height: 42, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px',
  fontSize: 14, color: C.ink, background: C.paper, fontFamily: FONT, boxSizing: 'border-box',
};

function RoleButton({ icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff',
        border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
        fontFamily: FONT, width: '100%',
      }}
    >
      <span style={{ flex: 'none', display: 'flex' }}>{icon}</span>
      <span>
        <b style={{ display: 'block', fontSize: 14, color: C.ink, fontWeight: 600 }}>{title}</b>
        <span style={{ fontSize: 12.5, color: C.grey }}>{sub}</span>
      </span>
    </button>
  );
}

export default function Login({ compact }) {
  const { signInDemo, signInLive, showToast, supaConfigured } = useSupport();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const doSignIn = async (e) => {
    e?.preventDefault();
    if (!supaConfigured) {
      showToast('No backend configured — pick a demo role below', 'warn');
      return;
    }
    if (!email || !password) {
      showToast('Enter your email and password', 'err');
      return;
    }
    setBusy(true);
    try {
      await signInLive(email, password);
    } catch (err) {
      showToast(err?.message || 'Sign in failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <div style={{ width: compact ? '100%' : 380, maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', color: C.ink, margin: '0 0 6px' }}>Sign in</h2>
      <p style={{ fontSize: 14, color: C.grey, margin: '0 0 26px' }}>Use your building operations account.</p>
      <form onSubmit={doSignIn}>
        <label style={label}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="d.chen@auro.building" autoComplete="email"
          style={{ ...input, marginBottom: 16 }} />
        <label style={label}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ ...input, marginBottom: 22 }} />
        <button type="submit" disabled={busy} style={{
          width: '100%', height: 44, background: C.brand, color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: C.wash }} />
        <span style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', color: C.faint }}>DEMO — CHOOSE A ROLE</span>
        <div style={{ flex: 1, height: 1, background: C.wash }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RoleButton icon={<User size={19} color={C.ink} strokeWidth={1.75} />}
          title="Concierge / building staff" sub="Create and track tickets"
          onClick={() => signInDemo('concierge')} />
        <RoleButton icon={<SprayCan size={19} color={C.ink} strokeWidth={1.75} />}
          title="Cleaning team" sub="Attend, photograph and complete jobs"
          onClick={() => signInDemo('cleaning')} />
        <RoleButton icon={<BarChart3 size={19} color={C.ink} strokeWidth={1.75} />}
          title="Admin / facility manager" sub="Analytics, billing and settings"
          onClick={() => signInDemo('admin')} />
      </div>
    </div>
  );

  if (compact) {
    // Mobile layout — brand header stacked above the form.
    return (
      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: FONT, color: C.body, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.ink, color: '#fff', padding: '56px 24px 32px' }}>
          <img src="/support/logo-light.png" alt="Focused Facilities Management" style={{ height: 24, width: 'auto' }} />
          <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: C.faint, margin: '20px 0 10px' }}>
            BUILDING SUPPORT TICKETS
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em', margin: 0, color: '#fff' }}>
            Every issue logged.<br />Every job accountable.
          </h1>
        </div>
        <div style={{ padding: '28px 24px 48px' }}>{form}</div>
      </div>
    );
  }

  return (
    <div data-screen-label="Login" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr', fontFamily: FONT, color: C.body }}>
      <div style={{ background: C.ink, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px' }}>
        <img src="/support/logo-light.png" alt="Focused Facilities Management" style={{ height: 26, width: 'auto', alignSelf: 'flex-start' }} />
        <div style={{ maxWidth: 520 }}>
          <div style={{ ...mono, fontSize: 11, letterSpacing: '0.12em', color: C.faint, marginBottom: 18 }}>
            BUILDING SUPPORT TICKETS · AURO
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 46, lineHeight: 1.06, letterSpacing: '-0.02em', margin: '0 0 12px', color: '#fff' }}>
            Every issue logged.<br />Every job accountable.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.hair, margin: 0 }}>
            Report, assign and close building support jobs — graffiti, spills, rubbish, damage and
            cleaning requests — with photos and timestamps on every visit.
          </p>
        </div>
        <div style={{ ...mono, fontSize: 11, letterSpacing: '0.1em', color: C.grey }}>
          AURO · 130 RIVERA ESPLANADE · LEVELS B2–86
        </div>
      </div>
      <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        {form}
      </div>
    </div>
  );
}
