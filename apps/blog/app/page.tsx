import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PageHeading } from './PageHeading';
import { formatDate } from '../lib/format';
import { allPosts } from '../lib/posts';
import { BLOG_DESCRIPTION } from '../lib/site';

export const metadata: Metadata = {
  description: BLOG_DESCRIPTION,
};

// Dev-only "+ New post"; the dead branch drops it from the production bundle.
const NewPostLink =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('./dev/NewPostLink').then((m) => m.NewPostLink));

export default function BlogIndex() {
  return (
    <>
      <PageHeading>Blog</PageHeading>
      <NewPostLink />
      <ul className="post-list">
        {allPosts.map((post) => (
          <li key={post.slug}>
            <Link className="post-title" href={`/${post.slug}/`}>
              {post.title}
            </Link>
            {post.draft && <span className="draft-badge">DRAFT</span>}
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.description && <p>{post.description}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
