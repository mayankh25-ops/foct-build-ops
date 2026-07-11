/* eslint-disable react-refresh/only-export-components */
// Central state for the support app — shared by the mobile and desktop UIs.
//
// Local-first: all reads come from React state hydrated out of IndexedDB, all
// writes land in IndexedDB immediately and are queued to the server through
// the sync engine. Demo mode (role picker on the login screen) runs the whole
// app with seeded data and no backend at all.
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { idb, uuid } from './db';
import { remote, supaConfigured } from './api';
import { startSync, stopSync, subscribeSync, syncNow, queue } from './sync';
import {
  DEFAULT_PDF_TEMPLATE, TICKET_PREFIX, fmtStamp, STATUSES, levelText, badgeStyle,
  PRIORITIES,
} from './constants';

const SupportContext = createContext(null);

// ---------------------------------------------------------------------------
// Demo seed — mirrors the design handoff's sample data exactly.
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  { id: 'u-daniel', name: 'Daniel Chen', email: 'd.chen@auro.building', role: 'concierge', team: 'Front desk — day', status: 'Active' },
  { id: 'u-priya', name: 'Priya Nair', email: 'p.nair@auro.building', role: 'concierge', team: 'Front desk — evening', status: 'Active' },
  { id: 'u-maya', name: 'Maya Silva', email: 'm.silva@subzero.services', role: 'cleaning', team: 'Day shift — Cleaning', status: 'Active' },
  { id: 'u-tomas', name: 'Tomás Rivera', email: 't.rivera@subzero.services', role: 'cleaning', team: 'Night shift — Cleaning', status: 'Active' },
  { id: 'u-rachel', name: 'Rachel Okafor', email: 'r.okafor@auro.building', role: 'admin', team: 'Facility management', status: 'Active' },
  { id: 'u-lena', name: 'Lena Wu', email: 'l.wu@subzero.services', role: 'cleaning-admin', team: 'Billing & invoicing', status: 'Invited' },
];

const DEMO_PERSONAS = {
  concierge: { name: 'Daniel Chen', roleLabel: 'Concierge — Auro Tower', initials: 'DC', team: '' },
  cleaning: { name: 'Maya Silva', roleLabel: 'Cleaning team — Day shift', initials: 'MS', team: 'Day shift — Cleaning' },
  admin: { name: 'Rachel Okafor', roleLabel: 'Facility manager', initials: 'RO', team: '' },
};

const DEMO_COMPANIES = [
  { id: 'co-auro', name: 'Auro Group', sites: [
    { id: 'site-tower', name: 'Auro Tower', addr: '130 Rivera Esplanade',
      levels: ['B2', 'B1', 'G', 'P', 'L1–L86'],
      areas: ['Lobby', 'Lift lobby', 'Corridor', 'Car park', 'Amenities', 'Refuse room', 'Loading dock'],
      issues: ['Graffiti', 'Spill', 'Rubbish', 'Glass clean', 'Bio clean', 'Chute clean', 'Pressure wash', 'Damage', 'Assistance', 'Adhoc work', 'Complaint'] },
    { id: 'site-quay', name: 'Auro Quay', addr: '18 Harbour Walk',
      levels: ['B1', 'G', 'L1–L12'],
      areas: ['Lobby', 'Marina deck', 'Corridor', 'Car park'],
      issues: ['Graffiti', 'Spill', 'Rubbish', 'Glass clean', 'Pressure wash', 'Damage', 'Complaint'] },
  ] },
  { id: 'co-meridian', name: 'Meridian Estates', sites: [
    { id: 'site-m1', name: 'Meridian One', addr: '2 Foundry Lane',
      levels: ['G', 'L1–L34'],
      areas: ['Lobby', 'Corridor', 'Amenities'],
      issues: ['Spill', 'Rubbish', 'Glass clean', 'Damage', 'Complaint'] },
  ] },
];

function demoTicket(t) {
  return {
    id: 'demo-' + t.ticketNo, demo: true, synced: true,
    remarks: '', chargeable: false, invoiceNo: '', notes: '', na: 0, nb: 0,
    ...t,
  };
}

const DEMO_TICKETS = [
  demoTicket({ ticketNo: 'AUR-1041', level: 'L7', area: 'Lift lobby', cat: 'Graffiti', prio: 'High', status: 'inprogress',
    desc: 'Black marker tags on the east wall beside lift bank B. Approx 1.5 m wide, chest height.',
    by: 'Daniel Chen · Concierge', team: 'Day shift — Cleaning', created: '04 JUL, 06:42',
    assignedAt: '04 JUL, 06:50', attendedAt: '04 JUL, 07:15', completedAt: '', nb: 2, na: 0,
    chargeable: true, notes: 'Resident in 07-03 reported it overnight. Second incident this month — consider CCTV review.' }),
  demoTicket({ ticketNo: 'AUR-1040', level: 'L23', area: 'Corridor', cat: 'Spill', prio: 'Urgent', status: 'completed',
    desc: 'Coffee spill outside apartment 23-08, spreading toward the lift lobby carpet edge.',
    by: 'Priya Nair · Concierge', team: 'Day shift — Cleaning', created: '04 JUL, 08:03',
    assignedAt: '04 JUL, 08:05', attendedAt: '04 JUL, 08:12', completedAt: '04 JUL, 08:31', nb: 1, na: 2,
    remarks: 'Mopped and dried. Wet-floor sign left in place for 30 minutes.' }),
  demoTicket({ ticketNo: 'AUR-1039', level: 'L41', area: 'Refuse room', cat: 'Rubbish', prio: 'Medium', status: 'attended',
    desc: 'Overflowing bins; bags stacked beside the chute door blocking access.',
    by: 'Auro FM portal', team: 'Day shift — Cleaning', created: '04 JUL, 05:20',
    assignedAt: '04 JUL, 05:40', attendedAt: '04 JUL, 06:05', completedAt: '', nb: 1, na: 0 }),
  demoTicket({ ticketNo: 'AUR-1038', level: 'P', area: 'Podium terrace', cat: 'Pressure wash', prio: 'Low', status: 'open',
    desc: 'Quarterly pressure wash of podium pavers — book for this week ahead of the resident event.',
    by: 'R. Okafor · Facility manager', team: '', created: '03 JUL, 16:11',
    assignedAt: '', attendedAt: '', completedAt: '', nb: 0, na: 0, chargeable: true }),
  demoTicket({ ticketNo: 'AUR-1037', level: 'L12', area: 'Corridor', cat: 'Damage', prio: 'Medium', status: 'assigned',
    desc: 'Deep scuff and chipped paint along the west corridor wall, near the service lift.',
    by: 'Daniel Chen · Concierge', team: 'Night shift — Cleaning', created: '03 JUL, 14:47',
    assignedAt: '03 JUL, 15:02', attendedAt: '', completedAt: '', nb: 2, na: 0,
    notes: 'Likely caused during the 12-05 move-out.' }),
  demoTicket({ ticketNo: 'AUR-1036', level: 'L55', area: 'Amenities', cat: 'Cleaning request', prio: 'Low', status: 'closed',
    desc: 'Gym mirror wall smudged; detail clean requested before the 06:00 opening.',
    by: 'Priya Nair · Concierge', team: 'Night shift — Cleaning', created: '02 JUL, 18:30',
    assignedAt: '02 JUL, 18:41', attendedAt: '03 JUL, 04:50', completedAt: '03 JUL, 05:20', nb: 1, na: 2,
    remarks: 'Detail clean completed before opening. Streak-free finish checked under gym lighting.',
    chargeable: true, invoiceNo: 'INV-2481' }),
  demoTicket({ ticketNo: 'AUR-1035', level: 'L68', area: 'Refuse room', cat: 'Complaint', prio: 'Medium', status: 'unable',
    desc: 'Resident complaint — persistent odour near the L68 bin chute.',
    by: 'Auro FM portal', team: 'Day shift — Cleaning', created: '02 JUL, 09:15',
    assignedAt: '02 JUL, 09:30', attendedAt: '02 JUL, 10:05', completedAt: '', nb: 1, na: 0,
    remarks: 'Chute access panel is locked. Requires the building engineer — escalated to FM.' }),
  demoTicket({ ticketNo: 'AUR-1034', level: 'L86', area: 'Sky lounge', cat: 'Resident report', prio: 'Low', status: 'awaiting',
    desc: 'Glass balustrade smudges across the sky lounge; resident event on Friday.',
    by: 'Daniel Chen · Concierge', team: 'Night shift — Cleaning', created: '01 JUL, 11:24',
    assignedAt: '01 JUL, 11:40', attendedAt: '02 JUL, 06:10', completedAt: '02 JUL, 07:05', nb: 1, na: 3,
    remarks: 'Full glass detail, both sides. Checked against the light at 07:00.', chargeable: true }),
  demoTicket({ ticketNo: 'AUR-1033', level: 'B2', area: 'Car park', cat: 'Graffiti', prio: 'High', status: 'closed',
    desc: 'Spray tags on pillar B2-14 near the roller door.',
    by: 'Night desk · Concierge', team: 'Day shift — Cleaning', created: '28 JUN, 22:12',
    assignedAt: '29 JUN, 06:00', attendedAt: '29 JUN, 06:35', completedAt: '29 JUN, 08:10', nb: 2, na: 2,
    remarks: 'Removed with solvent; pillar sealed and repainted.', chargeable: true, invoiceNo: 'INV-2477' }),
];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function SupportProvider({ children }) {
  const [session, setSession] = useState(null); // { mode, role, name, roleLabel, initials, team, userId }
  const [booted, setBooted] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [photos, setPhotos] = useState([]); // metadata only; blobs stay in IDB
  const [users, setUsers] = useState(DEMO_USERS);
  const [companies, setCompanies] = useState(DEMO_COMPANIES);
  const [pdfTemplate, setPdfTemplate] = useState(DEFAULT_PDF_TEMPLATE);
  const [sync, setSync] = useState({ online: true, pending: 0, syncing: false, lastError: null });
  const [toast, setToastState] = useState(null);
  const toastTimer = useRef(null);
  const urlCache = useRef(new Map()); // photoId -> objectURL

  const showToast = useCallback((msg, kind = 'ok') => {
    clearTimeout(toastTimer.current);
    setToastState({ msg, kind });
    toastTimer.current = setTimeout(() => setToastState(null), 3200);
  }, []);

  // ---- boot: restore session + cached data --------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedSession, savedTemplate, savedCompanies, cachedTickets, cachedPhotos] =
        await Promise.all([
          idb.metaGet('session'),
          idb.metaGet('pdfTemplate'),
          idb.metaGet('companies'),
          idb.getAll('tickets'),
          idb.getAll('photos'),
        ]);
      if (cancelled) return;
      if (savedTemplate) setPdfTemplate({ ...DEFAULT_PDF_TEMPLATE, ...savedTemplate });
      if (savedCompanies) setCompanies(savedCompanies);
      if (cachedTickets.length) setTickets(sortTickets(cachedTickets));
      if (cachedPhotos.length) setPhotos(cachedPhotos.map(({ blob, ...meta }) => ({ ...meta, hasBlob: !!blob })));
      if (savedSession) {
        setSession(savedSession);
        startSync({ enabled: savedSession.mode === 'live' });
        if (savedSession.mode === 'demo' && !cachedTickets.length) {
          await seedDemo();
        }
      }
      setBooted(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribeSync(setSync), []);

  // Refresh tickets from IDB after each successful sync pass.
  useEffect(() => {
    if (sync.syncing) return;
    let cancelled = false;
    (async () => {
      const rows = await idb.getAll('tickets');
      if (!cancelled && rows.length) setTickets(sortTickets(rows));
      const ph = await idb.getAll('photos');
      if (!cancelled && ph.length) setPhotos(ph.map(({ blob, ...meta }) => ({ ...meta, hasBlob: !!blob })));
    })();
    return () => { cancelled = true; };
  }, [sync.syncing, sync.lastSync]);

  async function seedDemo() {
    await idb.putMany('tickets', DEMO_TICKETS);
    setTickets(sortTickets(DEMO_TICKETS));
  }

  // ---- auth ----------------------------------------------------------------
  const signInDemo = useCallback(async (role) => {
    const p = DEMO_PERSONAS[role];
    const s = { mode: 'demo', role, ...p, userId: null };
    setSession(s);
    await idb.metaSet('session', s);
    const existing = await idb.getAll('tickets');
    if (!existing.length) await seedDemo();
    stopSync();
    showToast(`Signed in as ${p.name} — demo data, stored on this device`);
  }, [showToast]);

  const signInLive = useCallback(async (email, password) => {
    const profile = await remote.signIn(email, password);
    if (!profile) throw new Error('No support profile for this account — ask your admin to invite you.');
    const p = {
      mode: 'live', role: profile.role, name: profile.name,
      roleLabel: profile.role === 'admin' ? 'Facility manager'
        : profile.role === 'cleaning' ? `Cleaning team — ${profile.team || 'General'}`
        : 'Concierge',
      initials: (profile.name || 'U').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
      team: profile.team || '', userId: profile.id,
    };
    // Live mode starts from server truth — drop any demo rows.
    const all = await idb.getAll('tickets');
    for (const t of all) if (t.demo) await idb.delete('tickets', t.id);
    setTickets([]);
    setSession(p);
    await idb.metaSet('session', p);
    startSync({ enabled: true });
    remote.listUsers().then(setUsers).catch(() => {});
    showToast(`Signed in as ${p.name}`);
  }, [showToast]);

  const signOut = useCallback(async () => {
    stopSync();
    if (session?.mode === 'live') remote.signOut().catch(() => {});
    setSession(null);
    await idb.metaSet('session', null);
  }, [session]);

  const switchDemoRole = useCallback(async (role) => {
    if (!session) return;
    const p = DEMO_PERSONAS[role];
    const s = { ...session, role, ...p };
    setSession(s);
    await idb.metaSet('session', s);
  }, [session]);

  // ---- tickets -------------------------------------------------------------
  const nextTicketNo = useCallback(() => {
    let max = 1042;
    for (const t of tickets) {
      const m = /^(?:[A-Z]+)-(\d+)$/.exec(t.ticketNo || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${TICKET_PREFIX}-${max + 1}`;
  }, [tickets]);

  const persistTicket = useCallback(async (t) => {
    await idb.put('tickets', t);
    setTickets((cur) => sortTickets([t, ...cur.filter((x) => x.id !== t.id)]));
  }, []);

  const createTicket = useCallback(async (form) => {
    const assigned = form.assign && form.assign !== 'Unassigned — triage later';
    const t = {
      id: uuid(),
      ticketNo: nextTicketNo(),
      level: form.level,
      area: form.area || 'Common area',
      cat: form.category,
      prio: form.priority || 'Medium',
      status: assigned ? 'assigned' : 'open',
      desc: form.desc || '',
      by: `${session?.name || 'Unknown'} · ${session?.role === 'admin' ? 'Facility manager' : 'Concierge'}`,
      team: assigned ? form.assign : '',
      created: new Date().toISOString(),
      assignedAt: assigned ? new Date().toISOString() : '',
      attendedAt: '', completedAt: '',
      remarks: '', chargeable: false, invoiceNo: '', notes: '',
      nb: 0, na: 0,
      demo: session?.mode === 'demo',
      // Demo tickets live on-device by definition; live tickets are pending
      // until the outbox pushes them to the server.
      synced: session?.mode !== 'live',
    };
    await persistTicket(t);
    // Attach any photos captured during the wizard.
    for (const ph of form.photos || []) {
      await attachPhotoRecord(t.id, 'before', ph);
      t.nb += 1;
    }
    await idb.put('tickets', t);
    setTickets((cur) => sortTickets(cur.map((x) => (x.id === t.id ? t : x))));
    if (session?.mode === 'live') {
      await queue('upsertTicket', { ...t, userId: session.userId });
    }
    return t;
  }, [nextTicketNo, persistTicket, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchTicket = useCallback(async (id, patch) => {
    const cur = await idb.get('tickets', id);
    if (!cur) return;
    const next = { ...cur, ...patch, synced: session?.mode !== 'live' };
    await persistTicket(next);
    if (session?.mode === 'live') {
      if (cur.synced === false && !sync.pending) {
        await queue('upsertTicket', { ...next, userId: session.userId });
      } else {
        await queue('patchTicket', { id, patch });
      }
    }
    return next;
  }, [persistTicket, session, sync.pending]);

  async function attachPhotoRecord(ticketId, kind, file) {
    const id = uuid();
    const name = file.name || `IMG_${Date.now()}.jpg`;
    const record = { id, ticketId, kind, name, blob: file, uploaded: false, createdAt: Date.now() };
    await idb.put('photos', record);
    setPhotos((cur) => [...cur, { id, ticketId, kind, name, uploaded: false, hasBlob: true }]);
    return record;
  }

  const addPhoto = useCallback(async (ticketId, kind, file) => {
    const record = await attachPhotoRecord(ticketId, kind, file);
    const t = await idb.get('tickets', ticketId);
    if (t) {
      const key = kind === 'after' ? 'na' : 'nb';
      const next = { ...t, [key]: (t[key] || 0) + 1 };
      await persistTicket(next);
    }
    if (session?.mode === 'live') {
      await queue('uploadPhoto', { id: record.id });
    }
    return record;
  }, [persistTicket, session]);

  const removePhoto = useCallback(async (photoId) => {
    const rec = await idb.get('photos', photoId);
    if (!rec) return;
    await idb.delete('photos', photoId);
    setPhotos((cur) => cur.filter((p) => p.id !== photoId));
    const t = await idb.get('tickets', rec.ticketId);
    if (t) {
      const key = rec.kind === 'after' ? 'na' : 'nb';
      await persistTicket({ ...t, [key]: Math.max(0, (t[key] || 0) - 1) });
    }
  }, [persistTicket]);

  // Resolve a photo to a displayable URL (object URL for local blobs,
  // public URL once uploaded). Returns null for design-placeholder tiles.
  const photoUrl = useCallback((photo) => {
    if (!photo) return null;
    if (urlCache.current.has(photo.id)) return urlCache.current.get(photo.id);
    if (photo.storagePath && supaConfigured) {
      const url = remote.photoUrl(photo.storagePath);
      urlCache.current.set(photo.id, url);
      return url;
    }
    return null;
  }, []);

  const loadPhotoUrl = useCallback(async (photoId) => {
    if (urlCache.current.has(photoId)) return urlCache.current.get(photoId);
    const rec = await idb.get('photos', photoId);
    if (rec?.blob) {
      const url = URL.createObjectURL(rec.blob);
      urlCache.current.set(photoId, url);
      return url;
    }
    if (rec?.storagePath && supaConfigured) {
      const url = remote.photoUrl(rec.storagePath);
      urlCache.current.set(photoId, url);
      return url;
    }
    return null;
  }, []);

  // ---- settings ------------------------------------------------------------
  const saveCompanies = useCallback(async (next) => {
    setCompanies(next);
    await idb.metaSet('companies', next);
  }, []);

  const savePdfTemplate = useCallback(async (next) => {
    setPdfTemplate(next);
    await idb.metaSet('pdfTemplate', next);
  }, []);

  // ---- derived helpers ------------------------------------------------------
  const enrich = useCallback((t) => {
    const st = STATUSES[t.status] || STATUSES.open;
    const before = photos.filter((p) => p.ticketId === t.id && p.kind === 'before');
    const after = photos.filter((p) => p.ticketId === t.id && p.kind === 'after');
    const beforeTiles = before.length
      ? before
      : Array.from({ length: t.nb || 0 }, (_, i) => ({
          id: `ph-${t.id}-A${i}`, placeholder: true, name: `IMG_${(t.ticketNo || '').slice(4)}A${i + 1}.jpg`,
        }));
    const afterTiles = after.length
      ? after
      : Array.from({ length: t.na || 0 }, (_, i) => ({
          id: `ph-${t.id}-B${i}`, placeholder: true, name: `IMG_${(t.ticketNo || '').slice(4)}B${i + 1}.jpg`,
        }));
    return {
      ...t,
      stL: st.l, stBg: st.bg, stFg: st.fg,
      badgeS: badgeStyle(t.status),
      prioFg: PRIORITIES[t.prio] || PRIORITIES.Medium,
      levelText: levelText(t.level),
      teamText: t.team || 'Unassigned',
      byUpper: (t.by || '').toUpperCase(),
      created: t.created, createdD: fmtStamp(t.created),
      assignedD: t.assignedAt ? fmtStamp(t.assignedAt) : '—',
      attendedD: t.attendedAt ? fmtStamp(t.attendedAt) : '—',
      completedD: t.completedAt ? fmtStamp(t.completedAt) : '—',
      beforeTiles, afterTiles,
      nbShown: beforeTiles.length, naShown: afterTiles.length,
    };
  }, [photos]);

  const value = useMemo(() => ({
    booted, session, tickets, photos, users, companies, pdfTemplate,
    sync, toast, showToast,
    signInDemo, signInLive, signOut, switchDemoRole,
    createTicket, patchTicket, addPhoto, removePhoto, photoUrl, loadPhotoUrl,
    saveCompanies, savePdfTemplate, setUsers,
    syncNow, enrich, supaConfigured,
  }), [booted, session, tickets, photos, users, companies, pdfTemplate, sync,
    toast, showToast, signInDemo, signInLive, signOut, switchDemoRole,
    createTicket, patchTicket, addPhoto, removePhoto, photoUrl, loadPhotoUrl,
    saveCompanies, savePdfTemplate, enrich]);

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

function sortTickets(rows) {
  const key = (t) => {
    const d = new Date(t.created);
    if (!isNaN(d)) return d.getTime();
    const m = /^(?:[A-Z]+)-(\d+)$/.exec(t.ticketNo || '');
    return m ? parseInt(m[1], 10) : 0;
  };
  return [...rows].sort((a, b) => key(b) - key(a));
}

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error('useSupport must be used inside SupportProvider');
  return ctx;
}
