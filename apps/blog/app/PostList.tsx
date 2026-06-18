import Link from 'next/link';
import { formatDate } from '../lib/format';

export interface PostItem {
  slug: string;
  title: string;
  description?: string | undefined;
  date: string;
  draft: boolean;
  fallback?: boolean;
}

interface Props {
  posts: PostItem[];
  /** Maps a slug to its in-tree href, e.g. `(s) => \`/${s}/\`` for EN. */
  makeHref: (slug: string) => string;
  children?: React.ReactNode;
}

export function PostList({ posts, makeHref, children }: Props) {
  return (
    <>
      {children}
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link className="post-title" href={makeHref(post.slug)}>
              {post.title}
            </Link>
            {post.fallback && (
              <span className="post-lang-note" title="por enquanto">
                só em inglês
              </span>
            )}
            {post.draft && <span className="draft-badge">DRAFT</span>}
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.description && <p>{post.description}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
