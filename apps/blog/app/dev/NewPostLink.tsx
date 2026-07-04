'use client';
import Link from 'next/link';
import styles from './DevControls.module.scss';

// Dev-only floating "new post" action. Dead-branch-imported by the index so it
// (and its CSS) never ships to the static export.
export function NewPostLink() {
  return (
    <div className={styles.fabStack}>
      <Link
        className={`${styles.fab} ${styles.primary}`}
        href="/editor"
        aria-label="New post"
        title="New post"
      >
        +
      </Link>
    </div>
  );
}
