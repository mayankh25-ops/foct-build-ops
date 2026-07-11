// Desktop admin console — shell (sidebar + topbar) and screen router.
// Screens: dashboard (per role), tickets, create, detail, billing, pdf, settings.
import React, { useState, useCallback } from 'react';
import {
  LayoutGrid, Plus, Ticket, Receipt, FileText, Settings as SettingsIcon,
  Search, LogOut, RefreshCw,
} from 'lucide-react';
import { C, FONT } from '../constants';
import { mono, Toast, GlobalSupportStyles } from '../ui.jsx';
import { useSupport } from '../store.jsx';
import Login from './Login.jsx';
import { DashboardConcierge, DashboardCleaning, DashboardAdmin } from './Dashboards.jsx';
import TicketsList from './TicketsList.jsx';
import CreateTicket from './CreateTicket.jsx';
import TicketDetail from './TicketDetail.jsx';
import Billing from './Billing.jsx';
import PdfReport from './PdfReport.jsx';
import Settings from './Settings.jsx';

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <a
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 8,
        fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none',
        color: active ? '#fff' : C.hair, background: active ? C.brand : 'transparent',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge !== '0' && (
        <span style={{ ...mono, fontSize: 10.5, background: C.brand, color: '#fff', borderRadius: 999, padding: '1px 7px' }}>
          {badge}
        </span>
      )}
    </a>
  );
}

export default function SupportDesktop() {
  const { session, booted, tickets, sync, signOut, switchDemoRole, syncNow, showToast } = useSupport();
  const [screen, setScreen] = useState('dashboard');
  const [curId, setCurId] = useState(null);
  const [q, setQ] = useState('');

  const role = session?.role || 'concierge';
  const isAdmin = role === 'admin';
  const isCleaning = role === 'cleaning';
  const isConcierge = role === 'concierge';
  const canBilling = isAdmin || isCleaning;
  const canCreate = isConcierge || isAdmin;

  const go = useCallback((s, id = null) => {
    setScreen(s);
    if (id !== null) setCurId(id);
    window.scrollTo(0, 0);
  }, []);
  const openTicket = useCallback((id) => go('detail', id), [go]);

  if (!booted) return null;
  if (!session) {
    return (
      <div className="support-app">
        <GlobalSupportStyles />
        <Login />
        <Toast />
      </div>
    );
  }

  const awaitingN = tickets.filter((t) => t.chargeable && !t.invoiceNo && ['awaiting', 'completed'].includes(t.status)).length;
  const offline = !sync.online && session.mode === 'live';

  const titles = {
    dashboard: 'Dashboard',
    tickets: isCleaning ? 'My tickets' : 'Tickets',
    create: 'Create ticket',
    detail: 'Ticket',
    billing: 'Billing',
    pdf: 'PDF report',
    settings: 'Settings',
  };

  const screens = {
    dashboard: isAdmin ? <DashboardAdmin go={go} openTicket={openTicket} />
      : isCleaning ? <DashboardCleaning openTicket={openTicket} />
      : <DashboardConcierge go={go} openTicket={openTicket} />,
    tickets: <TicketsList q={q} openTicket={openTicket} role={role} canBilling={canBilling} clearQ={() => setQ('')} />,
    create: canCreate ? <CreateTicket go={go} /> : null,
    detail: <TicketDetail id={curId} go={go} role={role} />,
    billing: canBilling ? <Billing openTicket={openTicket} /> : null,
    pdf: <PdfReport id={curId} role={role} />,
    settings: isAdmin ? <Settings go={go} /> : null,
  };

  return (
    <div className="support-app" style={{ fontFamily: FONT, color: C.body, minHeight: '100vh', background: C.bg }}>
      <GlobalSupportStyles />
      <div style={{ display: 'grid', gridTemplateColumns: '246px 1fr', minHeight: '100vh' }}>
        {/* Sidebar */}
        <div style={{
          background: C.ink, color: C.hair, display: 'flex', flexDirection: 'column',
          padding: '22px 14px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box',
        }}>
          <div style={{ padding: '4px 10px 8px' }}>
            <img src="/support/logo-light.png" alt="Focused Facilities Management" style={{ height: 21, width: 'auto', display: 'block' }} />
            <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.14em', color: C.grey, marginTop: 7 }}>SUPPORT TICKETS</div>
          </div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.grey, padding: '18px 10px 8px' }}>
            Operations
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <NavItem icon={<LayoutGrid size={18} strokeWidth={1.75} />} label="Dashboard"
              active={screen === 'dashboard'} onClick={() => go('dashboard')} />
            {canCreate && (
              <NavItem icon={<Plus size={18} strokeWidth={1.75} />} label="Create ticket"
                active={screen === 'create'} onClick={() => go('create')} />
            )}
            <NavItem icon={<Ticket size={18} strokeWidth={1.75} />} label={isCleaning ? 'My tickets' : 'Tickets'}
              active={screen === 'tickets' || screen === 'detail'} onClick={() => go('tickets')} />
            {canBilling && (
              <NavItem icon={<Receipt size={18} strokeWidth={1.75} />} label="Billing"
                active={screen === 'billing'} onClick={() => go('billing')} badge={String(awaitingN)} />
            )}
            <NavItem icon={<FileText size={18} strokeWidth={1.75} />} label="PDF reports"
              active={screen === 'pdf'} onClick={() => go('pdf')} />
            {isAdmin && (
              <NavItem icon={<SettingsIcon size={18} strokeWidth={1.75} />} label="Settings"
                active={screen === 'settings'} onClick={() => go('settings')} />
            )}
          </nav>
          <div style={{ marginTop: 'auto' }}>
            <button
              onClick={() => session.mode === 'live' ? syncNow() : showToast('Demo mode — data stays on this device')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 10, width: '100%',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 12,
                background: 'transparent', cursor: 'pointer',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flex: 'none',
                background: session.mode === 'demo' ? C.grey : offline || sync.pending ? C.amber : C.green,
              }} />
              <span style={{ ...mono, fontSize: 10, letterSpacing: '0.08em', color: C.hair, whiteSpace: 'nowrap' }}>
                {session.mode === 'demo' ? 'DEMO — ON THIS DEVICE'
                  : offline ? `OFFLINE · ${sync.pending} QUEUED`
                  : sync.syncing ? 'SYNCING…'
                  : sync.pending ? `${sync.pending} QUEUED — TAP TO SYNC`
                  : 'ALL CHANGES SYNCED'}
              </span>
              {sync.syncing && <RefreshCw size={11} color={C.hair} style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto' }} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 0', borderTop: '1px solid rgba(255,255,255,0.14)' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: C.inkSoft, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none',
              }}>
                {session.initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <b style={{ color: '#fff', fontSize: 13, fontWeight: 600, display: 'block', whiteSpace: 'nowrap' }}>{session.name}</b>
                <span style={{ fontSize: 11.5, color: C.grey }}>{session.roleLabel}</span>
              </div>
              <LogOut size={16} color={C.grey} strokeWidth={1.75}
                style={{ marginLeft: 'auto', cursor: 'pointer', flex: 'none' }}
                onClick={() => { signOut(); setScreen('dashboard'); }} />
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {offline && (
            <div style={{
              background: C.amberWash, borderBottom: `1px solid ${C.amberLine}`, padding: '8px 28px',
              ...mono, fontSize: 11, letterSpacing: '0.08em', color: C.amber,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <RefreshCw size={14} strokeWidth={1.75} />
              WORKING OFFLINE — DRAFTS AND PHOTOS SAVED LOCALLY, WILL SYNC WHEN CONNECTED
            </div>
          )}
          <div style={{
            background: '#fff', borderBottom: `1px solid ${C.wash}`, height: 66,
            display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px',
            position: 'sticky', top: 0, zIndex: 20,
          }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: C.ink, whiteSpace: 'nowrap' }}>
              {titles[screen] || 'Dashboard'}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 380, marginLeft: 8 }}>
              <Search size={16} color={C.faint} strokeWidth={1.75} style={{ position: 'absolute', left: 12 }} />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (e.target.value && screen !== 'tickets') setScreen('tickets');
                }}
                placeholder='Search — try "Level 7 graffiti"'
                style={{
                  width: '100%', height: 38, padding: '0 12px 0 36px', border: `1px solid ${C.line}`,
                  borderRadius: 8, fontSize: 13.5, background: C.paper, color: C.ink, fontFamily: FONT,
                }}
              />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              {session.mode === 'demo' && (
                <select
                  value={role}
                  onChange={(e) => {
                    const r = e.target.value;
                    switchDemoRole(r);
                    if (r === 'concierge' && ['billing', 'settings'].includes(screen)) setScreen('dashboard');
                    if (r === 'cleaning' && ['settings', 'create'].includes(screen)) setScreen('dashboard');
                  }}
                  style={{
                    height: 36, border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff',
                    fontSize: 13, color: C.slate, padding: '0 8px', cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <option value="concierge">Viewing as: Concierge</option>
                  <option value="cleaning">Viewing as: Cleaning team</option>
                  <option value="admin">Viewing as: Admin</option>
                </select>
              )}
              {canCreate && (
                <button
                  onClick={() => go('create')}
                  style={{
                    height: 38, display: 'flex', alignItems: 'center', gap: 8, background: C.brand,
                    color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px',
                    fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <Plus size={15} strokeWidth={2} />
                  New ticket
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: '26px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {screens[screen] || screens.dashboard}
          </div>
        </div>
      </div>
      <Toast />
    </div>
  );
}
