// @ts-check
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openOpLog } from './oplog.js';

let dbSeq = 0;
const freshDb = () => `test-oplog-${dbSeq++}`;

async function makeKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** @returns {import('./types').Op} */
function makeOp(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    type: 'ADD',
    todoId: crypto.randomUUID(),
    fields: { title: 'Test' },
    hlc: '0001749600000000-00000-aaaa',
    ...overrides,
  };
}

describe('OpLog', () => {
  it('round-trips a single op', async () => {
    const key = await makeKey();
    const log = await openOpLog(freshDb());
    const op = makeOp();
    await log.append(key, op);
    const all = await log.readAll(key);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(op);
  });

  it('round-trips multiple ops', async () => {
    const key = await makeKey();
    const log = await openOpLog(freshDb());
    const ops = [
      makeOp({ hlc: '0001749600000001-00000-aaaa' }),
      makeOp({ hlc: '0001749600000003-00000-aaaa' }),
      makeOp({ hlc: '0001749600000002-00000-aaaa' }),
    ];
    for (const op of ops) await log.append(key, op);
    const all = await log.readAll(key);
    expect(all.map((o) => o.hlc)).toEqual([
      '0001749600000001-00000-aaaa',
      '0001749600000002-00000-aaaa',
      '0001749600000003-00000-aaaa',
    ]);
  });

  it('idempotent: re-appending same id is a no-op', async () => {
    const key = await makeKey();
    const log = await openOpLog(freshDb());
    const op = makeOp({ fields: { title: 'Original' } });
    await log.append(key, op);
    await log.append(key, { ...op, fields: { title: 'Should be ignored' } });
    const all = await log.readAll(key);
    expect(all).toHaveLength(1);
    expect(all[0].fields?.title).toBe('Original');
  });

  it('readAll returns ops sorted by HLC regardless of insertion order', async () => {
    const key = await makeKey();
    const log = await openOpLog(freshDb());
    const hlcs = [
      '0001749600000005-00000-aaaa',
      '0001749600000001-00000-aaaa',
      '0001749600000003-00000-aaaa',
    ];
    for (const hlc of hlcs) await log.append(key, makeOp({ hlc }));
    const all = await log.readAll(key);
    const sorted = [...hlcs].sort();
    expect(all.map((o) => o.hlc)).toEqual(sorted);
  });
});
