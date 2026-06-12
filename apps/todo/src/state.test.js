// @ts-check
import { describe, it, expect } from 'vitest';
import { applyOps } from './state.js';

let seq = 0;
const hlc = (n = seq++) => `0001749600000${String(n).padStart(3, '0')}-00000-aaaa`;
const id = () => `id-${seq++}`;

describe('applyOps', () => {
  it('ADD creates a todo', () => {
    const todoId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Buy milk', list: 'personal' }, hlc: hlc() },
    ]);
    const item = state.get(todoId);
    expect(item).not.toBeNull();
    expect(item?.title).toBe('Buy milk');
    expect(item?.listId).toBe('personal');
    expect(item?.completed).toBe(false);
  });

  it('EDIT updates title', () => {
    const todoId = id();
    const t0 = hlc(); const t1 = hlc();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Old' }, hlc: t0 },
      { id: id(), type: 'EDIT', todoId, fields: { title: 'New' }, hlc: t1 },
    ]);
    expect(state.get(todoId)?.title).toBe('New');
  });

  it('EDIT moves todo to different list', () => {
    const todoId = id();
    const t0 = hlc(); const t1 = hlc();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Task', list: 'personal' }, hlc: t0 },
      { id: id(), type: 'EDIT', todoId, fields: { list: 'work' }, hlc: t1 },
    ]);
    expect(state.get(todoId)?.listId).toBe('work');
    expect(state.get(todoId)?.title).toBe('Task');
  });

  it('COMPLETE sets completed=true', () => {
    const todoId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Task' }, hlc: hlc() },
      { id: id(), type: 'COMPLETE', todoId, hlc: hlc() },
    ]);
    expect(state.get(todoId)?.completed).toBe(true);
  });

  it('ADD → EDIT → COMPLETE sequence', () => {
    const todoId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Draft' }, hlc: hlc() },
      { id: id(), type: 'EDIT', todoId, fields: { title: 'Final' }, hlc: hlc() },
      { id: id(), type: 'COMPLETE', todoId, hlc: hlc() },
    ]);
    const item = state.get(todoId);
    expect(item?.title).toBe('Final');
    expect(item?.completed).toBe(true);
  });

  it('concurrent EDITs converge to max-HLC winner', () => {
    const todoId = id();
    const t0 = hlc(); const t1 = hlc(); const t2 = hlc();
    // t2 > t1 > t0 — regardless of application order, t2 wins
    const ops = [
      { id: id(), type: /** @type {'ADD'} */ ('ADD'), todoId, fields: { title: 'A' }, hlc: t0 },
      { id: id(), type: /** @type {'EDIT'} */ ('EDIT'), todoId, fields: { title: 'B' }, hlc: t2 },
      { id: id(), type: /** @type {'EDIT'} */ ('EDIT'), todoId, fields: { title: 'C' }, hlc: t1 },
    ];
    expect(applyOps(ops).get(todoId)?.title).toBe('B');
    // reversed order should still converge
    expect(applyOps([...ops].reverse()).get(todoId)?.title).toBe('B');
  });

  it('DELETE tombstones the item', () => {
    const todoId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Gone' }, hlc: hlc() },
      { id: id(), type: 'DELETE', todoId, hlc: hlc() },
    ]);
    expect(state.get(todoId)).toBeNull();
  });

  it('DELETE tombstone beats concurrent EDIT (lower HLC edit)', () => {
    const todoId = id();
    const t0 = hlc(); const t1 = hlc(); const t2 = hlc();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'A' }, hlc: t0 },
      { id: id(), type: 'DELETE', todoId, hlc: t2 },
      { id: id(), type: 'EDIT', todoId, fields: { title: 'B' }, hlc: t1 },
    ]);
    expect(state.get(todoId)).toBeNull();
  });

  it('duplicate op id is a no-op', () => {
    const todoId = id();
    const dupId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'A' }, hlc: hlc() },
      { id: dupId, type: 'EDIT', todoId, fields: { title: 'B' }, hlc: hlc() },
      { id: dupId, type: 'EDIT', todoId, fields: { title: 'C' }, hlc: hlc() },
    ]);
    expect(state.get(todoId)?.title).toBe('B');
  });

  it('UNCOMPLETE resets completed=false', () => {
    const todoId = id();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Task' }, hlc: hlc() },
      { id: id(), type: 'COMPLETE', todoId, hlc: hlc() },
      { id: id(), type: 'UNCOMPLETE', todoId, hlc: hlc() },
    ]);
    expect(state.get(todoId)?.completed).toBe(false);
  });

  it('COMPLETE wins over concurrent UNCOMPLETE at lower HLC', () => {
    const todoId = id();
    const t0 = hlc(); const t1 = hlc(); const t2 = hlc();
    const state = applyOps([
      { id: id(), type: 'ADD', todoId, fields: { title: 'Task' }, hlc: t0 },
      { id: id(), type: 'UNCOMPLETE', todoId, hlc: t1 },
      { id: id(), type: 'COMPLETE', todoId, hlc: t2 },
    ]);
    expect(state.get(todoId)?.completed).toBe(true);
  });

  it('unknown todoId returns undefined', () => {
    const state = applyOps([]);
    expect(state.get('nonexistent')).toBeUndefined();
  });
});
