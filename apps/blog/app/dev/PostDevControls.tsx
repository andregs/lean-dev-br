'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './DevControls.module.scss';

interface Props {
  slug: string;
  locale?: 'en' | 'pt-BR';
}

// Dev-only floating edit/delete controls for a post. Dead-branch-imported by the
// post page so it (and its CSS) never ships to the static export. Delete has no
// confirmation by design — `git` is the undo.
export function PostDevControls({ slug, locale = 'en' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function del() {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ slug, locale });
      const res = await fetch(`/blog/api/draft/?${params.toString()}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { error?: string; detail?: string };
      if (!res.ok) throw new Error(data.detail ?? data.error ?? 'delete failed');
      const returnPath = locale === 'pt-BR' ? '/pt-BR/' : '/';
      router.push(returnPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const editHref = locale === 'pt-BR'
    ? `/editor?slug=${slug}&locale=pt-BR`
    : `/editor?slug=${slug}`;

  return (
    <div className={styles.fabStack}>
      {error && <span className={styles.error}>{error}</span>}
      <Link className={styles.fab} href={editHref} aria-label="Edit post" title="Edit post">
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
