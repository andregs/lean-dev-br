import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostList } from '../../../PostList';
import { PageHeading } from '../../../PageHeading';
import { allTags, postsByTag } from '../../../../lib/posts';

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
    <PostList posts={posts} makeHref={(s) => `/${s}/`}>
      <PageHeading>#{tag}</PageHeading>
    </PostList>
  );
}
