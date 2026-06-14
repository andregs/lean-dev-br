// @ts-check
/** @import { KeyProvider } from './types' */

const LS_KEY = 'todo-passkey-credId';
const IDB_NAME = 'todo-session';
const IDB_STORE = 'sessions';
const IDB_KEY = 'current';

// Fixed 32-byte PRF input — same across all devices so PRF output is deterministic.
// Changing this would invalidate all previously encrypted op logs.
const PRF_SALT = new Uint8Array([
  0x6c, 0x65, 0x61, 0x6e, 0x2e, 0x64, 0x65, 0x76, // "lean.dev"
  0x2e, 0x62, 0x72, 0x3a, 0x74, 0x6f, 0x64, 0x6f, // ".br:todo"
  0x3a, 0x70, 0x72, 0x66, 0x3a, 0x76, 0x31, 0x00, // ":prf:v1\0"
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // padding
]);

const HKDF_INFO = new TextEncoder().encode('lean.dev.br:oplog:v1');
const HKDF_SALT = new Uint8Array(32);

/** @param {ArrayBuffer | Uint8Array} buf */
function toHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** @returns {Promise<IDBDatabase>} */
function openSessionDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {{ roomId: string, aesKey: CryptoKey }} session */
async function saveSession(session) {
  const db = await openSessionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(session, IDB_KEY);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

/** @returns {Promise<{ roomId: string, aesKey: CryptoKey } | null>} */
async function loadSession() {
  const db = await openSessionDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** @param {string} hex */
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * @param {ArrayBuffer} prfFirst
 * @returns {Promise<CryptoKey>}
 */
async function deriveAesKey(prfFirst) {
  const hkdfKey = await crypto.subtle.importKey('raw', prfFirst, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * KeyProvider backed by a WebAuthn passkey with the PRF extension.
 * roomId = credential ID hex (stable across devices for the same passkey).
 * @implements {KeyProvider}
 */
export class SyncedPasskeyKeyProvider {
  /** @type {string} */
  #credIdHex;

  /** @param {string} credIdHex */
  constructor(credIdHex) {
    this.#credIdHex = credIdHex;
  }

  /**
   * Load from localStorage. Returns null if no passkey registered yet.
   * @returns {SyncedPasskeyKeyProvider | null}
   */
  static load() {
    const hex = localStorage.getItem(LS_KEY);
    return hex ? new SyncedPasskeyKeyProvider(hex) : null;
  }

  /**
   * Restore a cached session from IndexedDB — skips WebAuthn on reload.
   * The CryptoKey is stored non-extractable: raw bytes never leave the browser engine.
   * Returns null if no cache or the stored credential no longer matches localStorage.
   * @returns {Promise<{ roomId: string, aesKey: CryptoKey } | null>}
   */
  static async restoreSession() {
    try {
      const session = await loadSession();
      if (!session) return null;
      if (localStorage.getItem(LS_KEY) !== session.roomId) return null;
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Register a new passkey with PRF, persist credential ID, return provider.
   * Call once on first use; subsequent uses go through resolve().
   * @returns {Promise<SyncedPasskeyKeyProvider>}
   */
  static async register() {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const cred = /** @type {PublicKeyCredential} */ (
      await navigator.credentials.create({
        publicKey: {
          rp: { name: 'lean.dev.br todo', id: location.hostname },
          user: { id: userId, name: 'todo-user', displayName: 'Todo User' },
          challenge,
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          extensions: { prf: {} },
        },
      })
    );

    const hex = toHex(cred.rawId);
    localStorage.setItem(LS_KEY, hex);
    return new SyncedPasskeyKeyProvider(hex);
  }

  /**
   * Authenticate via discoverable credential (no stored credId required).
   * Browser shows passkey picker. Stores the credId on success so future
   * visits use the targeted resolve() path.
   * @returns {Promise<{ roomId: string, aesKey: CryptoKey }>}
   */
  static async discover() {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = /** @type {PublicKeyCredential} */ (
      await navigator.credentials.get({
        publicKey: {
          rpId: location.hostname,
          challenge,
          allowCredentials: [],
          userVerification: 'preferred',
          extensions: { prf: { eval: { first: PRF_SALT } } },
        },
      })
    );
    const ext = assertion.getClientExtensionResults();
    const prfFirst = /** @type {any} */ (ext)?.prf?.results?.first;
    if (!prfFirst) throw new Error('PRF extension unavailable — authenticator may not support it');
    const hex = toHex(assertion.rawId);
    localStorage.setItem(LS_KEY, hex);
    const aesKey = await deriveAesKey(prfFirst);
    await saveSession({ roomId: hex, aesKey });
    return { roomId: hex, aesKey };
  }

  /**
   * Authenticate with the stored passkey, derive AES key from PRF output.
   * @returns {Promise<{ roomId: string, aesKey: CryptoKey }>}
   */
  async resolve() {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = /** @type {PublicKeyCredential} */ (
      await navigator.credentials.get({
        publicKey: {
          rpId: location.hostname,
          challenge,
          allowCredentials: [{ type: 'public-key', id: fromHex(this.#credIdHex) }],
          userVerification: 'preferred',
          extensions: { prf: { eval: { first: PRF_SALT } } },
        },
      })
    );

    const ext = assertion.getClientExtensionResults();
    const prfFirst = /** @type {any} */ (ext)?.prf?.results?.first;
    if (!prfFirst) throw new Error('PRF extension unavailable — authenticator may not support it');

    const aesKey = await deriveAesKey(prfFirst);
    await saveSession({ roomId: this.#credIdHex, aesKey });
    return { roomId: this.#credIdHex, aesKey };
  }
}
