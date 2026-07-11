// Offline sync engine.
//
// Every mutation is written to IndexedDB first (instant, works with no
// reception), and an outbox entry is queued. The engine replays the outbox —
// in order, idempotently — whenever the device comes back online, on a fixed
// interval, and on demand ("Sync now"). Pulls then refresh the local cache.
import { idb, uuid } from './db';
import { remote, supaConfigured } from './api';

const AUTO_INTERVAL_MS = 60_000; // auto-sync every minute while the app is open

const state = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastSync: null,
  lastError: null,
  enabled: false, // false in demo mode — everything stays local
};

const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn({ ...state }));
}

async function refreshPending() {
  const rows = await idb.getAll('outbox');
  state.pending = rows.length;
  emit();
}

export async function queue(type, payload) {
  await idb.put('outbox', { id: uuid(), createdAt: Date.now(), type, payload });
  await refreshPending();
  if (state.enabled && state.online) flush();
}

let flushPromise = null;
export function flush() {
  if (flushPromise) return flushPromise;
  flushPromise = doFlush().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function doFlush() {
  if (!state.enabled || !supaConfigured) return;
  const rows = (await idb.getAll('outbox')).sort((a, b) => a.createdAt - b.createdAt);
  if (!rows.length) return;
  state.syncing = true;
  state.lastError = null;
  emit();
  try {
    for (const op of rows) {
      await applyOp(op);
      await idb.delete('outbox', op.id);
      state.pending = Math.max(0, state.pending - 1);
      emit();
    }
    state.lastSync = Date.now();
  } catch (e) {
    // Stop at the first failing op; order is preserved and we retry later.
    state.lastError = e?.message || String(e);
    if (isNetworkError(e)) state.online = false;
  } finally {
    state.syncing = false;
    emit();
  }
}

function isNetworkError(e) {
  const msg = (e?.message || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}

async function applyOp(op) {
  if (op.type === 'upsertTicket') {
    const local = await idb.get('tickets', op.payload.id);
    const t = local || op.payload;
    const saved = await remote.upsertTicket(t, op.payload.userId);
    await idb.put('tickets', { ...t, ...saved, synced: true });
  } else if (op.type === 'patchTicket') {
    const saved = await remote.patchTicket(op.payload.id, op.payload.patch);
    if (saved) {
      const local = await idb.get('tickets', op.payload.id);
      await idb.put('tickets', { ...(local || {}), ...saved, synced: true });
    }
  } else if (op.type === 'uploadPhoto') {
    const photo = await idb.get('photos', op.payload.id);
    if (!photo || !photo.blob) return; // nothing to upload (already gone)
    const path = await remote.uploadPhoto(photo);
    await idb.put('photos', { ...photo, uploaded: true, storagePath: path });
  }
}

let pullPromise = null;
export function pull() {
  if (pullPromise) return pullPromise;
  pullPromise = doPull().finally(() => {
    pullPromise = null;
  });
  return pullPromise;
}

async function doPull() {
  if (!state.enabled || !supaConfigured) return null;
  const pendingOps = await idb.getAll('outbox');
  const dirtyIds = new Set(
    pendingOps.map((op) => op.payload?.id).filter(Boolean)
  );
  const [tickets, photos] = await Promise.all([remote.pullTickets(), remote.pullPhotos()]);
  // Server rows win except for tickets with queued local edits.
  const fresh = tickets.filter((t) => !dirtyIds.has(t.id));
  await idb.putMany('tickets', fresh);
  for (const p of photos) {
    const local = await idb.get('photos', p.id);
    await idb.put('photos', { ...(local || {}), ...p });
  }
  state.lastSync = Date.now();
  state.online = true;
  emit();
  return { tickets: fresh.length, photos: photos.length };
}

export async function syncNow() {
  if (!state.enabled) return;
  try {
    await flush();
    await pull();
  } catch (e) {
    state.lastError = e?.message || String(e);
    if (isNetworkError(e)) state.online = false;
    emit();
  }
}

let timer = null;
let wired = false;

export function startSync({ enabled }) {
  state.enabled = enabled && supaConfigured;
  refreshPending();
  if (!wired && typeof window !== 'undefined') {
    wired = true;
    window.addEventListener('online', () => {
      state.online = true;
      emit();
      syncNow();
    });
    window.addEventListener('offline', () => {
      state.online = false;
      emit();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.online) syncNow();
    });
  }
  if (timer) clearInterval(timer);
  if (state.enabled) {
    timer = setInterval(() => {
      if (state.online) syncNow();
    }, AUTO_INTERVAL_MS);
    if (state.online) syncNow();
  }
  emit();
}

export function stopSync() {
  if (timer) clearInterval(timer);
  timer = null;
  state.enabled = false;
  emit();
}

export function subscribeSync(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export function syncState() {
  return { ...state };
}
