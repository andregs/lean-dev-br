import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '../../lib/format';
import { allPosts, getAdjacent, getPost } from '../../lib/posts';
import { AUTHOR, blogUrl } from '../../lib/site';

// Dev-only edit/delete bar; the dead branch drops it from the production bundle.
const PostDevControls =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('../dev/PostDevControls').then((m) => m.PostDevControls));

export function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = blogUrl(`/${slug}/`);
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: url,
      types: { 'application/rss+xml': blogUrl('/feed.xml') },
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { prev, next } = getAdjacent(slug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.date,
    description: post.description,
    author: { '@type': 'Person', name: AUTHOR },
    url: blogUrl(`/${slug}/`),
    keywords: post.tags.join(', '),
  };

  return (
    <article className="post">
      <PostDevControls slug={slug} />
      {/* JSON-LD is data, not executed script — safe to inline under the CSP. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header>
        <div className="post-title-row">
          <h1>{post.title}</h1>
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
                <Link href={`/tags/${tag}/`}>#{tag}</Link>
              </li>
            ))}
          </ul>
        )}
        {(prev ?? next) && (
          <nav className="post-nav">
            <div className="post-nav-prev">
              {prev && (
                <Link href={`/${prev.slug}/`}>
                  <span className="post-nav-label">← Previous</span>
                  <span className="post-nav-title">{prev.title}</span>
                </Link>
              )}
            </div>
            <div className="post-nav-next">
              {next && (
                <Link href={`/${next.slug}/`}>
                  <span className="post-nav-label">Next →</span>
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
