import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostList } from '../../../../PostList';
import { PageHeading } from '../../../../PageHeading';
import { allTagsFor, postsByTagLocalized } from '../../../../../lib/posts';
import { tagLabel } from '../../../../../lib/tag-labels';

export function generateStaticParams() {
  return allTagsFor('pt-BR').map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag}`,
    description: `Posts com a tag #${tag}.`,
  };
}

export default async function PtBRTagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const posts = postsByTagLocalized('pt-BR', tag);
  if (posts.length === 0) notFound();

  return (
    <PostList posts={posts} makeHref={(s) => `/pt-BR/${s}/`}>
      <PageHeading>#{tagLabel(tag, 'pt-BR')}</PageHeading>
    </PostList>
  );
}
