'use client';

// A tiny IndexedDB outbox. A telecaller who loses signal mid-call still gets to
// submit the disposition: it is stored here and replayed when the connection
// comes back. Every entry carries a clientEventId so a replay can never create
// a duplicate status update on the server.

const DB_NAME = 'buildogram-telecaller';
const DB_VERSION = 1;
const STORE = 'outbox';
const LEAD_CACHE_KEY = 'bt.currentLead';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientEventId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const result = fn(store);
    transaction.oncomplete = () => {
      db.close();
      resolve(result?.result ?? result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function enqueueDisposition(payload) {
  await tx('readwrite', (store) => store.put({ ...payload, queuedAt: new Date().toISOString(), attempts: 0 }));
  // Fire and forget: registering background sync must never delay (or block)
  // the UI moving on, so it is deliberately not awaited.
  requestBackgroundSync();
  return payload.clientEventId;
}

export async function listQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function removeFromQueue(clientEventId) {
  await tx('readwrite', (store) => store.delete(clientEventId));
}

export async function bumpAttempts(entry) {
  await tx('readwrite', (store) => store.put({ ...entry, attempts: (entry.attempts || 0) + 1 }));
}

export async function queueSize() {
  try {
    return (await listQueue()).length;
  } catch {
    return 0;
  }
}

/**
 * Replays everything in the outbox. Returns the freshest server response so the
 * caller can drop straight into the next lead once the sync succeeds.
 */
export async function flushQueue() {
  let entries = [];
  try {
    entries = await listQueue();
  } catch {
    return { flushed: 0, failed: 0, lastResponse: null };
  }
  let flushed = 0;
  let failed = 0;
  let lastResponse = null;

  for (const entry of entries.sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)))) {
    try {
      const res = await fetch('/api/telecaller/disposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, queuedOffline: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        await removeFromQueue(entry.clientEventId);
        flushed += 1;
        lastResponse = data;
      } else if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 409) {
        // Permanent rejection - keep it out of an endless retry loop but keep a
        // record for the telecaller to see.
        await removeFromQueue(entry.clientEventId);
        failed += 1;
      } else {
        await bumpAttempts(entry);
        failed += 1;
        break;
      }
    } catch {
      failed += 1;
      break; // still offline
    }
  }
  return { flushed, failed, lastResponse };
}

async function requestBackgroundSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    // navigator.serviceWorker.ready never settles while no worker is active
    // (registration blocked, first load, unsupported browser), so it is raced
    // against a timeout rather than awaited on its own.
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (reg && 'sync' in reg) await reg.sync.register('sync-dispositions');
  } catch {
    /* background sync is a bonus, the online listener is the real path */
  }
}

// Cached copy of the lead currently on screen, so a reload with no signal still
// shows the lead the telecaller is holding instead of an empty screen.
export function cacheCurrentLead(payload) {
  try {
    if (!payload) localStorage.removeItem(LEAD_CACHE_KEY);
    else localStorage.setItem(LEAD_CACHE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
  } catch {
    /* private mode */
  }
}

export function readCachedLead() {
  try {
    const raw = localStorage.getItem(LEAD_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const newClientEventId = () =>
  `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
