// @ts-check
/** @import { SyncStatus } from './types' */
import * as Y from 'yjs';
import { decrypt, encrypt } from './crypto.js';

const TAG = '[sync]';

const IDB_NAME = 'todo-sync-meta';
const IDB_STORE = 'cursors';

// Below Firestore's 500-write batch-commit limit and well under the server's
// 1000-update room cap — bounds cold-start download size for long-lived rooms.
const COMPACT_THRESHOLD = 200;

// ── IDB helpers ───────────────────────────────────────────────────────────────

/** @returns {Promise<IDBDatabase>} */
function openMetaDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * @param {IDBDatabase} db
 * @param {string} key
 * @returns {Promise<unknown>}
 */
function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * @param {IDBDatabase} db
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<void>}
 */
function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

// ── binary ↔ base64 helpers ───────────────────────────────────────────────────

/** @param {Uint8Array} bytes @returns {string} */
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));

/** @param {string} b64 @returns {Uint8Array} */
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// ── sync ──────────────────────────────────────────────────────────────────────

/**
 * Manual sync provider over the encrypted Yjs blob relay.
 *
 * Protocol (one syncNow() round):
 *   1. Pull: GET /rooms/{room}/updates?since={cursor}&epoch={epoch}
 *      - epoch mismatch → server returns all blobs; client re-pushes full state.
 *      - Each blob: base64-decode outer → decrypt → base64-decode inner → Y.applyUpdate.
 *      - Skip undecryptable blobs silently (wrong key / corrupt).
 *   2. Push: encode Yjs delta (since lastPushedSV), base64-encode inner binary,
 *      encrypt the base64 string, base64-encode outer ciphertext, POST.
 *   3. Compact: once cursor reaches COMPACT_THRESHOLD, encode the full Yjs state
 *      (no state vector) and POST it to /compact under a CAS on the current epoch.
 *      200 → server replaced the log with this single blob under a new epoch.
 *      409 → another device already compacted; the epoch mismatch resolves itself
 *      on the next pull().
 *
 * Encoding layers (pull side, mirrored on push):
 *   server b64  →  ciphertext (iv + AES-GCM payload)
 *                                  ↓ decrypt
 *                          inner b64  →  Yjs binary update
 *
 * The inner base64 is necessary because Yjs produces arbitrary binary that is
 * not valid UTF-8; the crypto.js API encrypts/decrypts strings.
 *
 * Triggers: syncNow() runs on every local write, page load, visibilitychange, and window focus.
 * Concurrent calls are serialised: the second caller sets a pending flag so exactly one
 * follow-up sync runs after the in-flight one completes.
 *
 * @param {string} signalUrl
 * @param {string} roomId
 * @param {CryptoKey} aesKey
 * @param {Y.Doc} yjsDoc
 * @param {(status: SyncStatus) => void} onStatus
 * @returns {{ syncNow(): Promise<void>, stop(): void }}
 */
export function createSync(signalUrl, roomId, aesKey, yjsDoc, onStatus) {
  const roomUrl = `${signalUrl}/rooms/${encodeURIComponent(roomId)}`;

  let stopped = false;
  /** @type {string | null} */
  let epoch = null;
  let cursor = 0;
  /** @type {Uint8Array | null} */
  let lastPushedSV = null;
  /** @type {IDBDatabase | null} */
  let metaDb = null;

  const EPOCH_KEY = `epoch:${roomId}`;
  const CURSOR_KEY = `cursor:${roomId}`;
  const SV_KEY = `sv:${roomId}`;

  async function loadMeta() {
    metaDb = await openMetaDb();
    epoch = /** @type {string|null} */ (await idbGet(metaDb, EPOCH_KEY)) ?? null;
    cursor = /** @type {number} */ (await idbGet(metaDb, CURSOR_KEY)) ?? 0;
    lastPushedSV = /** @type {Uint8Array|null} */ (await idbGet(metaDb, SV_KEY)) ?? null;
  }

  async function saveMeta() {
    if (!metaDb) return;
    await idbPut(metaDb, EPOCH_KEY, epoch);
    await idbPut(metaDb, CURSOR_KEY, cursor);
    if (lastPushedSV) await idbPut(metaDb, SV_KEY, lastPushedSV);
  }

  /** @returns {Promise<boolean>} true if epoch changed (full re-push needed) */
  async function pull() {
    const url = `${roomUrl}/updates?since=${cursor}&epoch=${epoch ?? ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET updates → ${res.status}`);
    /** @type {{ epoch: string, cursor: number, updates: string[] }} */
    const body = await res.json();

    const epochChanged = body.epoch !== epoch;
    if (epochChanged) {
      console.log(TAG, 'epoch changed — will re-push full state');
      lastPushedSV = null;
    }

    for (const outerB64 of body.updates) {
      try {
        const ciphertext = fromB64(outerB64);
        const innerB64 = await decrypt(aesKey, ciphertext);
        const update = fromB64(innerB64);
        Y.applyUpdate(yjsDoc, update, 'remote');
      } catch {
        console.warn(TAG, 'skipping undecryptable blob');
      }
    }

    epoch = body.epoch;
    cursor = body.cursor;
    return epochChanged;
  }

  /** @param {boolean} [fullState] */
  async function push(fullState = false) {
    const sv = fullState || !lastPushedSV ? undefined : lastPushedSV;
    const delta = Y.encodeStateAsUpdate(yjsDoc, sv);

    // Yjs empty-delta sentinel: [0, 0] — nothing to push
    if (delta.byteLength <= 2) return;

    const innerB64 = toB64(delta);              // binary → base64 (binary-safe)
    const ciphertext = await encrypt(aesKey, innerB64);
    const outerB64 = toB64(ciphertext);         // ciphertext → base64 (for JSON)

    const res = await fetch(`${roomUrl}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update: outerB64 }),
    });
    if (!res.ok) throw new Error(`POST updates → ${res.status}`);
    /** @type {{ epoch: string, seq: number }} */
    const body = await res.json();
    cursor = body.seq; // pull() only reflects the count as of before this push
    lastPushedSV = Y.encodeStateVector(yjsDoc);
  }

  async function compact() {
    const full = Y.encodeStateAsUpdate(yjsDoc); // full GC'd state, not Y.snapshot (history)
    const innerB64 = toB64(full);
    const ciphertext = await encrypt(aesKey, innerB64);
    const outerB64 = toB64(ciphertext);

    const res = await fetch(`${roomUrl}/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update: outerB64, baseEpoch: epoch }),
    });
    if (res.status === 409) return; // another device compacted first — next pull() resolves it
    if (!res.ok) throw new Error(`POST compact → ${res.status}`);
    /** @type {{ epoch: string, seq: number }} */
    const body = await res.json();
    epoch = body.epoch;
    cursor = body.seq;
    lastPushedSV = Y.encodeStateVector(yjsDoc);
  }

  const metaReady = loadMeta();

  let _syncing = false;
  let _pendingSync = false;

  async function syncNow() {
    if (stopped) return;
    if (_syncing) { _pendingSync = true; return; }
    _syncing = true;
    await metaReady;
    onStatus('syncing');
    try {
      const epochChanged = await pull();
      await push(epochChanged);
      if (cursor >= COMPACT_THRESHOLD) await compact();
      await saveMeta();
      onStatus('synced');
    } catch (err) {
      console.error(TAG, 'sync failed', err);
      onStatus('error');
    } finally {
      _syncing = false;
      if (_pendingSync) { _pendingSync = false; syncNow(); }
    }
  }

  function onLocalUpdate(/** @type {Uint8Array} */ _update, /** @type {unknown} */ origin) {
    if (origin !== 'remote' && !stopped) syncNow();
  }
  yjsDoc.on('update', onLocalUpdate);

  return {
    syncNow,
    stop() {
      stopped = true;
      yjsDoc.off('update', onLocalUpdate);
    },
  };
}
