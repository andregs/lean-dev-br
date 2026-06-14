// @ts-check
import 'fake-indexeddb/auto';
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

  function reset() {
    epoch = crypto.randomUUID();
    updates = [];
  }

  return { post, get, reset };
}

/**
 * Build a createSync client wired to the in-memory relay (no real fetch).
 * @param {ReturnType<typeof makeRelay>} relay
 * @param {Y.Doc} yjsDoc
 * @param {CryptoKey} key
 */
function makeClient(relay, yjsDoc, key) {
  const status = vi.fn();

  const fetchStub = vi.fn(async (/** @type {string} */ url, /** @type {any} */ opts) => {
    if (opts?.method === 'POST') {
      const body = JSON.parse(opts.body);
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

  const sync = createSync('http://relay', 'room1', key, yjsDoc, status);
  return { sync, status, fetchStub };
}

describe('createSync', () => {
  it('pushes local ops and peer pulls them', async () => {
    const key = await makeKey();
    const relay = makeRelay();

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Mutate before registering sync listener so auto-sync is not triggered during setup
    const mapA = new Y.Map();
    mapA.set('title', 'Hello');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 1);
    docA.getMap('todos').set('id-1', mapA);

    const { sync: syncA } = makeClient(relay, docA, key);
    await syncA.syncNow();

    const { sync: syncB } = makeClient(relay, docB, key);
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

    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const mapA = new Y.Map();
    mapA.set('title', 'Pre-reset');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 1);
    docA.getMap('todos').set('id-1', mapA);

    const { sync: syncA } = makeClient(relay, docA, key);
    await syncA.syncNow(); // A pushes, cursor=1

    relay.reset(); // simulate server restart — new epoch, empty store

    const { sync: syncB } = makeClient(relay, docB, key);
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

    // Push one blob with the wrong key (mutate before makeClient to avoid auto-sync race)
    const docGarbage = new Y.Doc();
    const mapG = new Y.Map();
    mapG.set('title', 'Garbled');
    mapG.set('completed', false);
    mapG.set('listId', 'tasks');
    mapG.set('createdAt', 1);
    docGarbage.getMap('todos').set('g', mapG);
    const { sync: syncGarbage } = makeClient(relay, docGarbage, wrongKey);
    await syncGarbage.syncNow();

    // Push a valid blob with the correct key
    const docA = new Y.Doc();
    const mapA = new Y.Map();
    mapA.set('title', 'Good');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 2);
    docA.getMap('todos').set('id-good', mapA);
    const { sync: syncA } = makeClient(relay, docA, key);
    await syncA.syncNow();

    // Receiver should apply the valid blob and skip the garbled one
    const docB = new Y.Doc();
    const { sync: syncB } = makeClient(relay, docB, key);
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
    const doc = new Y.Doc();
    const { sync, status } = makeClient(relay, doc, key);

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
});
