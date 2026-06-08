import Link from 'next/link';
import { allPosts } from '../lib/posts';
import { formatDate } from '../lib/format';

export default function BlogIndex() {
  return (
    <>
      <h1>Blog</h1>
      <ul className="post-list">
        {allPosts.map((post) => (
          <li key={post.slug}>
            <Link href={`/${post.slug}`}>{post.title}</Link>
            {post.draft && <span className="draft-badge">DRAFT</span>}
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.description && <p>{post.description}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
