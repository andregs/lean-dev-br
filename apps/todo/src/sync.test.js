// @ts-check
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createSync } from './sync.js';

async function makeKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Tiny in-memory relay implementing the same epoch/seq/cursor contract as UpdateStore.
 */
function makeRelay() {
  let epoch = crypto.randomUUID();
  /** @type {string[]} */
  let updates = [];

  function post(/** @type {string} */ update) {
    updates.push(update);
    return { epoch, seq: updates.length };
  }

  function get(since = 0, clientEpoch = '') {
    const epochChanged = clientEpoch !== epoch;
    const effectiveSince = epochChanged ? 0 : since;
    return { epoch, cursor: updates.length, updates: updates.slice(effectiveSince) };
  }

  /** @returns {{ epoch: string, seq: number } | null} null = epoch mismatch (409) */
  function compact(/** @type {string} */ update, /** @type {string} */ baseEpoch) {
    if (baseEpoch !== epoch) return null;
    updates = [update];
    epoch = crypto.randomUUID();
    return { epoch, seq: 1 };
  }

  function reset() {
    epoch = crypto.randomUUID();
    updates = [];
  }

  return { post, get, compact, reset };
}

/**
 * Drives `count` local changes through `sync`, each under the 'remote' origin so the
 * doc's auto-sync listener doesn't also fire — keeps exactly one push per syncNow() call.
 * @param {ReturnType<typeof createSync>} sync
 * @param {Y.Doc} doc
 * @param {number} count
 */
async function driveLocalUpdates(sync, doc, count) {
  const m = doc.getMap('driver');
  for (let i = 0; i < count; i++) {
    doc.transact(() => m.set('n', i), 'remote');
    await sync.syncNow();
  }
}

/**
 * Build a createSync client wired to the in-memory relay (no real fetch).
 *
 * Each call gets its own fake IndexedDB — sync.js persists meta keyed only by roomId,
 * which is correct for a single real device but would let two simulated devices in the
 * same room clobber each other's cursor/epoch if they shared one global IndexedDB.
 * @param {ReturnType<typeof makeRelay>} relay
 * @param {Y.Doc} yjsDoc
 * @param {CryptoKey} key
 * @param {string} roomId
 */
function makeClient(relay, yjsDoc, key, roomId) {
  const status = vi.fn();

  const fetchStub = vi.fn(async (/** @type {string} */ url, /** @type {any} */ opts) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
      if (url.endsWith('/compact')) {
        const result = relay.compact(body.update, body.baseEpoch);
        if (!result) return { ok: false, status: 409, json: async () => ({}) };
        return { ok: true, json: async () => result };
      }
      const result = relay.post(body.update);
      return { ok: true, json: async () => result };
    }
    const u = new URL(url, 'http://x');
    const since = Number(u.searchParams.get('since') ?? '0');
    const epoch = u.searchParams.get('epoch') ?? '';
    const result = relay.get(since, epoch);
    return { ok: true, json: async () => result };
  });

  vi.stubGlobal('fetch', fetchStub);
  vi.stubGlobal('indexedDB', new IDBFactory());

  const sync = createSync('http://relay', roomId, key, yjsDoc, status);
  return { sync, status, fetchStub };
}

describe('createSync', () => {
  it('pushes local ops and peer pulls them', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Mutate before registering sync listener so auto-sync is not triggered during setup
    const mapA = new Y.Map();
    mapA.set('title', 'Hello');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 1);
    docA.getMap('todos').set('id-1', mapA);

    const { sync: syncA } = makeClient(relay, docA, key, roomId);
    await syncA.syncNow();

    const { sync: syncB } = makeClient(relay, docB, key, roomId);
    await syncB.syncNow();

    expect(docB.getMap('todos').size).toBe(1);
    expect(docB.getMap('todos').get('id-1')?.get('title')).toBe('Hello');

    syncA.stop();
    syncB.stop();
    vi.unstubAllGlobals();
  });

  it('epoch change causes full re-push and re-pull', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const mapA = new Y.Map();
    mapA.set('title', 'Pre-reset');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 1);
    docA.getMap('todos').set('id-1', mapA);

    const { sync: syncA } = makeClient(relay, docA, key, roomId);
    await syncA.syncNow(); // A pushes, cursor=1

    relay.reset(); // simulate server restart — new epoch, empty store

    const { sync: syncB } = makeClient(relay, docB, key, roomId);
    await syncA.syncNow(); // A detects epoch change → re-pushes full state
    await syncB.syncNow(); // B pulls

    expect(docB.getMap('todos').get('id-1')?.get('title')).toBe('Pre-reset');

    syncA.stop();
    syncB.stop();
    vi.unstubAllGlobals();
  });

  it('skips undecryptable blobs without aborting', async () => {
    const key = await makeKey();
    const wrongKey = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();

    // Push one blob with the wrong key (mutate before makeClient to avoid auto-sync race)
    const docGarbage = new Y.Doc();
    const mapG = new Y.Map();
    mapG.set('title', 'Garbled');
    mapG.set('completed', false);
    mapG.set('listId', 'tasks');
    mapG.set('createdAt', 1);
    docGarbage.getMap('todos').set('g', mapG);
    const { sync: syncGarbage } = makeClient(relay, docGarbage, wrongKey, roomId);
    await syncGarbage.syncNow();

    // Push a valid blob with the correct key
    const docA = new Y.Doc();
    const mapA = new Y.Map();
    mapA.set('title', 'Good');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 2);
    docA.getMap('todos').set('id-good', mapA);
    const { sync: syncA } = makeClient(relay, docA, key, roomId);
    await syncA.syncNow();

    // Receiver should apply the valid blob and skip the garbled one
    const docB = new Y.Doc();
    const { sync: syncB } = makeClient(relay, docB, key, roomId);
    await syncB.syncNow();

    const items = [...docB.getMap('todos').values()];
    expect(items.some((m) => m.get('title') === 'Good')).toBe(true);
    expect(items.every((m) => m.get('title') !== 'Garbled')).toBe(true);

    syncGarbage.stop();
    syncA.stop();
    syncB.stop();
    vi.unstubAllGlobals();
  });

  it('local write auto-triggers sync', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();
    const doc = new Y.Doc();
    const { sync, status } = makeClient(relay, doc, key, roomId);

    await sync.syncNow(); // initial sync — establishes epoch + cursor

    const map = new Y.Map();
    map.set('title', 'New local');
    map.set('completed', false);
    map.set('listId', 'tasks');
    map.set('createdAt', 1);
    doc.getMap('todos').set('x', map); // triggers auto-sync

    await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith('synced'));

    sync.stop();
    vi.unstubAllGlobals();
  });

  it('compaction fires once cursor reaches the threshold and collapses the log', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();
    const doc = new Y.Doc();
    const { sync } = makeClient(relay, doc, key, roomId);

    await driveLocalUpdates(sync, doc, 200);

    // mismatched epoch forces the relay to return its full log; cursor reflects its size
    const probe = relay.get(0, '');
    expect(probe.updates).toHaveLength(1);
    expect(probe.cursor).toBe(1);

    sync.stop();
    vi.unstubAllGlobals();
  });

  it('a previously-synced client converges after a peer compacts', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const { sync: syncA } = makeClient(relay, docA, key, roomId);
    const { sync: syncB } = makeClient(relay, docB, key, roomId);

    await syncA.syncNow();
    await syncB.syncNow(); // B is synced before A drives the room past the threshold

    await driveLocalUpdates(syncA, docA, 200); // last syncNow() triggers compaction

    await syncB.syncNow(); // B detects the epoch change and re-syncs

    expect(docB.getMap('driver').get('n')).toBe(199);

    syncA.stop();
    syncB.stop();
    vi.unstubAllGlobals();
  });

  it('a cold-start client pulls the single compacted blob', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();
    const docA = new Y.Doc();

    const { sync: syncA } = makeClient(relay, docA, key, roomId);
    await driveLocalUpdates(syncA, docA, 200);

    const docC = new Y.Doc();
    const { sync: syncC, fetchStub } = makeClient(relay, docC, key, roomId);
    await syncC.syncNow();

    expect(docC.getMap('driver').get('n')).toBe(199);
    const getCalls = fetchStub.mock.calls.filter(([, opts]) => opts?.method !== 'POST');
    expect(getCalls).toHaveLength(1); // single compacted blob — no extra round-trips needed

    syncA.stop();
    syncC.stop();
    vi.unstubAllGlobals();
  });

  it('a 409 from compact is treated as a no-op', async () => {
    const key = await makeKey();
    const relay = makeRelay();
    const roomId = crypto.randomUUID();
    const doc = new Y.Doc();
    const { sync, status, fetchStub } = makeClient(relay, doc, key, roomId);

    const passthrough = /** @type {(url: string, opts: any) => Promise<any>} */ (
      fetchStub.getMockImplementation()
    );
    fetchStub.mockImplementation(async (/** @type {string} */ url, /** @type {any} */ opts) => {
      if (opts?.method === 'POST' && url.endsWith('/compact')) {
        return { ok: false, status: 409, json: async () => ({}) };
      }
      return passthrough(url, opts);
    });

    await driveLocalUpdates(sync, doc, 200);

    expect(status).not.toHaveBeenCalledWith('error');
    const probe = relay.get(0, ''); // log was NOT collapsed — compact was rejected
    expect(probe.updates).toHaveLength(200);

    sync.stop();
    vi.unstubAllGlobals();
  });
});
