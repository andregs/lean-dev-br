/**
 * A single operation in the op log. Each op is encrypted individually
 * before it touches IndexedDB or the wire.
 */
export interface Op {
  id: string;
  type: 'ADD' | 'EDIT' | 'COMPLETE' | 'DELETE';
  todoId: string;
  /** Mutable string fields (title, list, …). COMPLETE/DELETE don't use this. */
  fields?: Record<string, string>;
  hlc: string;
}

/**
 * Materialised view of a single todo item, produced by reducing an op log.
 * `hlc` is the max HLC across all fields — useful as a sync cursor.
 */
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  /** Which list this todo belongs to (e.g. 'personal', 'work'). */
  listId: string;
  hlc: string;
}
