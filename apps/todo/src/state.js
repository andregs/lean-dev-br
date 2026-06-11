// @ts-check
/** @import { Op, TodoItem } from './types' */
import { hlcCompare } from './hlc.js';

/**
 * Per-field LWW register: track value + the HLC at which it was written.
 * @template T
 * @param {{ value: T, hlc: string } | undefined} current
 * @param {T} value
 * @param {string} hlc
 */
function lww(current, value, hlc) {
  if (!current || hlcCompare(hlc, current.hlc) > 0) return { value, hlc };
  return current;
}

/**
 * Reduce an ordered op log into current todo state.
 * Returns null for tombstoned (deleted) items.
 * @param {Op[]} ops
 * @returns {Map<string, TodoItem | null>}
 */
export function applyOps(ops) {
  /** @type {Map<string, {
   *   title?: { value: string, hlc: string },
   *   listId?: { value: string, hlc: string },
   *   completed?: { value: boolean, hlc: string },
   *   deletedHlc?: string
   * }>} */
  const raw = new Map();
  const seen = new Set();

  for (const op of ops) {
    if (seen.has(op.id)) continue;
    seen.add(op.id);

    const cur = raw.get(op.todoId) ?? {};

    if (op.type === 'ADD') {
      raw.set(op.todoId, {
        ...cur,
        title: lww(cur.title, op.fields?.title ?? '', op.hlc),
        listId: lww(cur.listId, op.fields?.list ?? '', op.hlc),
        completed: lww(cur.completed, false, op.hlc),
      });
    } else if (op.type === 'EDIT') {
      const next = { ...cur };
      if (op.fields?.title !== undefined) next.title = lww(cur.title, op.fields.title, op.hlc);
      if (op.fields?.list !== undefined) next.listId = lww(cur.listId, op.fields.list, op.hlc);
      raw.set(op.todoId, next);
    } else if (op.type === 'COMPLETE') {
      raw.set(op.todoId, { ...cur, completed: lww(cur.completed, true, op.hlc) });
    } else if (op.type === 'DELETE') {
      raw.set(op.todoId, {
        ...cur,
        deletedHlc: !cur.deletedHlc || hlcCompare(op.hlc, cur.deletedHlc) > 0
          ? op.hlc
          : cur.deletedHlc,
      });
    }
  }

  /** @type {Map<string, TodoItem | null>} */
  const result = new Map();
  for (const [todoId, s] of raw) {
    if (s.deletedHlc) {
      result.set(todoId, null);
      continue;
    }
    const hlc = [s.title?.hlc, s.listId?.hlc, s.completed?.hlc].filter(Boolean).sort().at(-1) ?? '';
    result.set(todoId, {
      id: todoId,
      title: s.title?.value ?? '',
      listId: s.listId?.value ?? '',
      completed: s.completed?.value ?? false,
      hlc,
    });
  }
  return result;
}
