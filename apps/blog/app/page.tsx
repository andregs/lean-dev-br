import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate } from '../lib/format';
import { allPosts } from '../lib/posts';
import { BLOG_DESCRIPTION } from '../lib/site';

export const metadata: Metadata = {
  description: BLOG_DESCRIPTION,
};

export default function BlogIndex() {
  return (
    <>
      <h1>Blog</h1>
      <hr className="rule" />
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
