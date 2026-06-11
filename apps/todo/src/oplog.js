// @ts-check
/** @import { Op } from './types' */
import { decrypt, encrypt } from './crypto.js';
import { hlcCompare } from './hlc.js';

const DB_NAME = 'todo-oplog';
const STORE = 'ops';

/** @param {IDBRequest} req */
function req(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {string} name */
function openDB(name) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(/** @type {IDBDatabase} */ (r.result));
    r.onerror = () => reject(r.error);
  });
}

export class OpLog {
  /** @type {IDBDatabase} */
  #db;

  /** @param {IDBDatabase} db */
  constructor(db) {
    this.#db = db;
  }

  /**
   * Encrypt and store op. Second append of same id is silently ignored.
   * @param {CryptoKey} aesKey
   * @param {Op} op
   */
  async append(aesKey, op) {
    const data = await encrypt(aesKey, JSON.stringify(op));
    const tx = this.#db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    try {
      await req(store.add({ id: op.id, data }));
    } catch (e) {
      if (/** @type {any} */ (e)?.name !== 'ConstraintError') throw e;
      console.debug('[oplog] skipped duplicate op id:', op.id);
    }
  }

  /**
   * Decrypt all stored ops, sorted by HLC.
   * @param {CryptoKey} aesKey
   * @returns {Promise<Op[]>}
   */
  async readAll(aesKey) {
    const tx = this.#db.transaction(STORE, 'readonly');
    const entries = /** @type {{ id: string, data: Uint8Array }[]} */ (
      await req(tx.objectStore(STORE).getAll())
    );
    const ops = await Promise.all(
      entries.map(({ data }) => decrypt(aesKey, data).then(JSON.parse)),
    );
    return ops.sort((a, b) => hlcCompare(a.hlc, b.hlc));
  }
}

/**
 * @param {string} [dbName]
 * @returns {Promise<OpLog>}
 */
export async function openOpLog(dbName = DB_NAME) {
  return new OpLog(/** @type {IDBDatabase} */ (await openDB(dbName)));
}
