// Tiny IndexedDB wrapper — the offline backbone of the support app.
// No dependencies, promise-based, resilient to blocked/aborted transactions.
//
// Stores:
//   tickets  — full ticket rows, keyed by client id (uuid)
//   photos   — photo metadata + Blob, keyed by uuid  { id, ticketId, kind, name, blob, uploaded }
//   outbox   — pending mutations to replay against the server, keyed by uuid
//   meta     — misc key/value (session, pdf template, counters, site config)

const DB_NAME = 'subzero-support';
const DB_VERSION = 1;
const STORES = ['tickets', 'photos', 'outbox', 'meta'];

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (name === 'photos') store.createIndex('ticketId', 'ticketId');
          if (name === 'outbox') store.createIndex('createdAt', 'createdAt');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        let result;
        try {
          result = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => {
          if (result && typeof result.then !== 'function' && 'result' in result) {
            resolve(result.result);
          } else {
            resolve(result);
          }
        };
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('IndexedDB transaction aborted'));
      })
  );
}

async function safe(promise, fallback) {
  try {
    return await promise;
  } catch (e) {
    // Offline storage must never take the app down — degrade to memory-only.
    console.warn('[support/db]', e);
    return fallback;
  }
}

export const idb = {
  async getAll(store) {
    return safe(tx(store, 'readonly', (s) => s.getAll()), []);
  },
  async get(store, id) {
    return safe(tx(store, 'readonly', (s) => s.get(id)), undefined);
  },
  async put(store, value) {
    return safe(tx(store, 'readwrite', (s) => s.put(value)), undefined);
  },
  async putMany(store, values) {
    return safe(
      tx(store, 'readwrite', (s) => {
        values.forEach((v) => s.put(v));
      }),
      undefined
    );
  },
  async delete(store, id) {
    return safe(tx(store, 'readwrite', (s) => s.delete(id)), undefined);
  },
  async clear(store) {
    return safe(tx(store, 'readwrite', (s) => s.clear()), undefined);
  },
  async photosByTicket(ticketId) {
    return safe(
      tx('photos', 'readonly', (s) => s.index('ticketId').getAll(ticketId)),
      []
    );
  },
  async metaGet(key, fallback = null) {
    const row = await this.get('meta', key);
    return row ? row.value : fallback;
  },
  async metaSet(key, value) {
    return this.put('meta', { id: key, value });
  },
};

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
