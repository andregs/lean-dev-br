import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '../../../lib/format';
import { allTags, postsByTag } from '../../../lib/posts';

export function generateStaticParams() {
  return allTags.map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag}`,
    description: `Posts tagged #${tag}.`,
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const posts = postsByTag(tag);
  if (posts.length === 0) notFound();

  return (
    <>
      <h1>#{tag}</h1>
      <hr className="rule" />
      <ul className="post-list">
        {posts.map((post) => (
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
