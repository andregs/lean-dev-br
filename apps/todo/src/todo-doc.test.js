// @ts-check
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

// Each test needs a fresh Y.Doc and todos map to avoid cross-test pollution.
function makeDoc() {
  const doc = new Y.Doc();
  /** @type {Y.Map<Y.Map<unknown>>} */
  const todos = doc.getMap('todos');

  /** @param {{ title: string, listId: string }} fields @returns {string} */
  function addTodo({ title, listId }) {
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

  /** @returns {import('./types').TodoItem[]} */
  function readTodos() {
    /** @type {import('./types').TodoItem[]} */
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

  /** @param {string} activeListId @returns {string[]} */
  function deriveLists(activeListId) {
    /** @type {Map<string, number>} */
    const seen = new Map();
    todos.forEach((map) => {
      const name = /** @type {string} */ (map.get('listId') ?? '');
      const at = /** @type {number} */ (map.get('createdAt') ?? 0);
      if (name && (!seen.has(name) || at < /** @type {number} */ (seen.get(name)))) {
        seen.set(name, at);
      }
    });
    const sorted = [...seen.entries()].sort(([, a], [, b]) => a - b).map(([n]) => n);
    if (!sorted.includes(activeListId)) sorted.push(activeListId);
    return sorted;
  }

  return { doc, todos, addTodo, readTodos, deriveLists };
}

describe('todo-doc (Y.Map CRDT behaviour)', () => {
  it('addTodo creates a readable item', () => {
    const { addTodo, readTodos } = makeDoc();
    const id = addTodo({ title: 'Buy milk', listId: '📋 tasks' });
    const items = readTodos();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id, title: 'Buy milk', completed: false, listId: '📋 tasks' });
  });

  it('editTitle updates in place', () => {
    const { addTodo, readTodos, todos } = makeDoc();
    const id = addTodo({ title: 'Old', listId: '📋 tasks' });
    todos.get(id)?.set('title', 'New');
    expect(readTodos()[0].title).toBe('New');
  });

  it('setCompleted toggles the completed field', () => {
    const { addTodo, readTodos, todos } = makeDoc();
    const id = addTodo({ title: 'Do thing', listId: '📋 tasks' });
    todos.get(id)?.set('completed', true);
    expect(readTodos()[0].completed).toBe(true);
  });

  it('removeTodo deletes the item', () => {
    const { addTodo, readTodos, todos } = makeDoc();
    const id = addTodo({ title: 'Gone', listId: '📋 tasks' });
    todos.delete(id);
    expect(readTodos()).toHaveLength(0);
  });

  it('clearDone deletes all completed items', () => {
    const { addTodo, readTodos, todos, doc } = makeDoc();
    const id1 = addTodo({ title: 'Keep', listId: '📋 tasks' });
    const id2 = addTodo({ title: 'Delete me', listId: '📋 tasks' });
    todos.get(id2)?.set('completed', true);
    const doneIds = readTodos()
      .filter((t) => t.completed)
      .map((t) => t.id);
    doc.transact(() => {
      for (const id of doneIds) todos.delete(id);
    });
    const remaining = readTodos();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(id1);
  });

  it('deriveLists includes activeListId even when empty', () => {
    const { deriveLists } = makeDoc();
    expect(deriveLists('🎯 new')).toContain('🎯 new');
  });

  it('deriveLists sorts by earliest createdAt', async () => {
    const { addTodo, deriveLists } = makeDoc();
    addTodo({ title: 'A', listId: 'work' });
    await new Promise((r) => setTimeout(r, 5));
    addTodo({ title: 'B', listId: 'home' });
    const lists = deriveLists('work');
    expect(lists[0]).toBe('work');
    expect(lists[1]).toBe('home');
  });

  it('onTodosChange observer fires only for remote-origin transactions', () => {
    const { doc, todos } = makeDoc();
    const cb = vi.fn();
    todos.observeDeep((_events, tx) => {
      if (tx.origin === 'remote') cb();
    });

    // Local mutation — no origin → should not fire
    const m = new Y.Map();
    todos.set('local', m);
    expect(cb).not.toHaveBeenCalled();

    // Remote mutation — should fire
    doc.transact(() => {
      todos.set('remote', new Y.Map());
    }, 'remote');
    expect(cb).toHaveBeenCalledOnce();
  });

  it('Yjs merges two docs conflict-free', () => {
    const { doc: docA, todos: todosA } = makeDoc();
    const { doc: docB } = makeDoc();

    const idA = crypto.randomUUID();
    const mapA = new Y.Map();
    mapA.set('title', 'From A');
    mapA.set('completed', false);
    mapA.set('listId', 'tasks');
    mapA.set('createdAt', 1);
    todosA.set(idA, mapA);

    // Sync A→B
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    const idB = crypto.randomUUID();
    const todosB = docB.getMap('todos');
    const mapB = new Y.Map();
    mapB.set('title', 'From B');
    mapB.set('completed', false);
    mapB.set('listId', 'tasks');
    mapB.set('createdAt', 2);
    todosB.set(idB, mapB);

    // Sync B→A
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));

    expect(todosA.size).toBe(2);
    expect(todosB.size).toBe(2);
    expect(todosA.get(idB)?.get('title')).toBe('From B');
    expect(todosB.get(idA)?.get('title')).toBe('From A');
  });
});
