'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './DevControls.module.scss';

// Dev-only floating edit/delete controls for a post. Dead-branch-imported by the
// post page so it (and its CSS) never ships to the static export. Delete has no
// confirmation by design — `git` is the undo.
export function PostDevControls({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function del() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/blog/api/draft/?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'delete failed');
      router.push('/'); // SPA back to the blog index (basePath-aware)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className={styles.fabStack}>
      {error && <span className={styles.error}>{error}</span>}
      <Link className={styles.fab} href={`/editor?slug=${slug}`} aria-label="Edit post" title="Edit post">
        ✏️
      </Link>
      <button
        type="button"
        className={`${styles.fab} ${styles.danger}`}
        aria-label="Delete post"
        title="Delete post"
        disabled={busy}
        onClick={() => {
          void del();
        }}
      >
        🗑️
      </button>
    </div>
  );
}
