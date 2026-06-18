import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { PostDetail } from '../../PostDetail';
import { allPosts, getAdjacent, getPost } from '../../../lib/posts';
import { AUTHOR, blogUrl } from '../../../lib/site';

const PostDevControls =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('../../dev/PostDevControls').then((m) => m.PostDevControls));

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
      languages: {
        en: url,
        'pt-BR': blogUrl(`/pt-BR/${slug}/`),
        'x-default': url,
      },
      types: { 'application/rss+xml': blogUrl('/feed.xml') },
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      tags: post.tags,
      images: [{ url: blogUrl('/opengraph-image.png') }],
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
    <PostDetail
      post={post}
      locale="en-US"
      prev={prev}
      next={next}
      makeHref={(s) => `/${s}/`}
      makeTagHref={(t) => `/tags/${t}/`}
      header={
        <>
          <PostDevControls slug={slug} />
          {/* JSON-LD is data, not executed script — safe to inline under the CSP. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </>
      }
    />
  );
}
