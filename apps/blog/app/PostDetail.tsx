import Link from 'next/link';
import { formatDate } from '../lib/format';
import { getT } from '../lib/i18n';
import type { Locale } from '../lib/posts';

interface PostLike {
  slug: string;
  title: string;
  description?: string | undefined;
  date: string;
  draft: boolean;
  html: string;
  tags: string[];
  fallback?: boolean;
}

interface Props {
  post: PostLike;
  locale: Locale;
  prev?: PostLike;
  next?: PostLike;
  /** Maps a slug to its in-tree href, e.g. `(s) => \`/${s}/\`` for EN. */
  makeHref: (slug: string) => string;
  /** Maps a tag slug to its in-tree href. */
  makeTagHref: (tag: string) => string;
  /** Maps a tag slug to its display label (localized). Defaults to identity. */
  tagDisplay?: (tag: string) => string;
  /** Slot for dev-only controls (PostDevControls) or JSON-LD. */
  header?: React.ReactNode;
}

export function PostDetail({
  post,
  locale,
  prev,
  next,
  makeHref,
  makeTagHref,
  tagDisplay,
  header,
}: Props) {
  const t = getT(locale);
  return (
    <article className="post">
      {header}
      <header>
        <div className="post-title-row">
          <h1>{post.title}</h1>
          {post.fallback && (
            <span className="post-lang-note" title="por enquanto">
              só em inglês
            </span>
          )}
          {post.draft && <span className="draft-badge">DRAFT</span>}
        </div>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </header>
      {/* Build-time HTML compiled from our own markdown (Velite + rehype-highlight). */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
      <footer className="post-footer">
        {post.tags.length > 0 && (
          <ul className="tag-list">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link href={makeTagHref(tag)}>#{tagDisplay ? tagDisplay(tag) : tag}</Link>
              </li>
            ))}
          </ul>
        )}
        {(prev ?? next) && (
          <nav className="post-nav">
            <div className="post-nav-prev">
              {prev && (
                <Link href={makeHref(prev.slug)}>
                  <span className="post-nav-label">{t('blog.post.nav.prev')}</span>
                  <span className="post-nav-title">{prev.title}</span>
                </Link>
              )}
            </div>
            <div className="post-nav-next">
              {next && (
                <Link href={makeHref(next.slug)}>
                  <span className="post-nav-label">{t('blog.post.nav.next')}</span>
                  <span className="post-nav-title">{next.title}</span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </footer>
    </article>
  );
}
