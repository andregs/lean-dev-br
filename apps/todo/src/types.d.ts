export interface KeyProvider {
  resolve(): Promise<{ roomId: string; aesKey: CryptoKey }>;
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  /** Which list this todo belongs to (e.g. '📋 tasks'). */
  listId: string;
  /** Wall-clock ms at creation time. Used as insertion-sort key; minor skew across devices is cosmetic. */
  createdAt: number;
}

export type SyncStatus = 'syncing' | 'synced' | 'error';
