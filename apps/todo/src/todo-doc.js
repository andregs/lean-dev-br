// @ts-check
/** @import { TodoItem } from './types' */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export const doc = new Y.Doc();

/** @type {Y.Map<Y.Map<unknown>>} todoId → {title, completed, listId, createdAt} */
const todos = doc.getMap('todos');

/**
 * Persist the Y.Doc locally. Must be called once per session before any mutations.
 * Returns a promise that resolves when IndexedDB has loaded the stored state.
 * @param {string} roomId  used as the IndexedDB database name so each passkey gets its own store
 * @returns {Promise<IndexeddbPersistence>}
 */
export function openPersistence(roomId) {
  const persistence = new IndexeddbPersistence(`todo-doc-${roomId}`, doc);
  return new Promise((resolve) => persistence.on('synced', () => resolve(persistence)));
}

// ── read ─────────────────────────────────────────────────────────────────────

/** @returns {TodoItem[]} current todos sorted by creation time */
export function readTodos() {
  /** @type {TodoItem[]} */
  const result = [];
  todos.forEach((map, id) => {
    result.push({
      id,
      title: /** @type {string} */ (map.get('title') ?? ''),
      completed: /** @type {boolean} */ (map.get('completed') ?? false),
      listId: /** @type {string} */ (map.get('listId') ?? ''),
      createdAt: /** @type {number} */ (map.get('createdAt') ?? 0),
    });
  });
  return result.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Derive sorted list names from current todos. Order is determined by the
 * earliest createdAt within each list so both devices agree after merging.
 * @param {string} activeListId  appended if not yet present (new empty list)
 * @returns {string[]}
 */
export function deriveLists(activeListId) {
  /** @type {Map<string, number>} name → earliest createdAt */
  const seen = new Map();
  todos.forEach((map) => {
    const name = /** @type {string} */ (map.get('listId') ?? '');
    const at = /** @type {number} */ (map.get('createdAt') ?? 0);
    if (name && (!seen.has(name) || at < /** @type {number} */ (seen.get(name)))) {
      seen.set(name, at);
    }
  });
  const sorted = [...seen.entries()].sort(([, a], [, b]) => a - b).map(([name]) => name);
  if (!sorted.includes(activeListId)) sorted.push(activeListId);
  return sorted;
}

// ── mutations ─────────────────────────────────────────────────────────────────

/**
 * @param {{ title: string, listId: string }} fields
 * @returns {string} the new todoId
 */
export function addTodo({ title, listId }) {
  const id = crypto.randomUUID();
  const map = new Y.Map();
  doc.transact(() => {
    map.set('title', title);
    map.set('completed', false);
    map.set('listId', listId);
    map.set('createdAt', Date.now());
    todos.set(id, map);
  });
  return id;
}

/** @param {string} id @param {string} title */
export function editTitle(id, title) {
  todos.get(id)?.set('title', title);
}

/** @param {string} id @param {boolean} completed */
export function setCompleted(id, completed) {
  todos.get(id)?.set('completed', completed);
}

/** @param {string} id */
export function removeTodo(id) {
  todos.delete(id);
}

/** @param {string[]} ids */
export function clearDone(ids) {
  doc.transact(() => {
    for (const id of ids) todos.delete(id);
  });
}

/**
 * Subscribe to remote changes in the todos map (origin === 'remote').
 * Local mutations are handled by surgical DOM updates in the UI; only peer-pushed
 * updates need a full re-render, which is what this callback triggers.
 * Returns an unsubscribe function.
 * @param {() => void} cb
 * @returns {() => void}
 */
export function onTodosChange(cb) {
  /** @param {Y.YEvent<any>[]} _events @param {Y.Transaction} tx */
  function handler(_events, tx) {
    if (tx.origin === 'remote') cb();
  }
  todos.observeDeep(handler);
  return () => todos.unobserveDeep(handler);
}
