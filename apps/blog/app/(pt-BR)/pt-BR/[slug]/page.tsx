import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostDetail } from '../../../PostDetail';
import { allPostsFor, getAdjacentLocalized, getPostLocalized } from '../../../../lib/posts';
import { tagLabel } from '../../../../lib/tag-labels';
import { AUTHOR, blogUrl } from '../../../../lib/site';

export function generateStaticParams() {
  return allPostsFor('pt-BR').map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostLocalized('pt-BR', slug);
  if (!post) return {};
  const url = blogUrl(`/pt-BR/${slug}/`);
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
      images: [{ url: blogUrl('/opengraph-image.png') }],
    },
  };
}

export default async function PtBRPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostLocalized('pt-BR', slug);
  if (!post) notFound();

  const { prev, next } = getAdjacentLocalized('pt-BR', slug);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.date,
    description: post.description,
    author: { '@type': 'Person', name: AUTHOR },
    url: blogUrl(`/pt-BR/${slug}/`),
    keywords: post.tags.join(', '),
    inLanguage: post.fallback ? 'en' : 'pt-BR',
  };

  return (
    <PostDetail
      post={post}
      locale="pt-BR"
      prev={prev}
      next={next}
      makeHref={(s) => `/pt-BR/${s}/`}
      makeTagHref={(t) => `/pt-BR/tags/${t}/`}
      tagDisplay={(t) => tagLabel(t, 'pt-BR')}
      header={
        /* JSON-LD is data, not executed script — safe to inline under the CSP. */
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      }
    />
  );
}
