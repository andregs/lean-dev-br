import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { PostList } from '../PostList';
import { PageHeading } from '../PageHeading';
import { allPosts } from '../../lib/posts';
import { BLOG_DESCRIPTION } from '../../lib/site';

export const metadata: Metadata = {
  description: BLOG_DESCRIPTION,
};

const NewPostLink =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('../dev/NewPostLink').then((m) => m.NewPostLink));

export default function BlogIndex() {
  return (
    <PostList posts={allPosts} makeHref={(s) => `/${s}/`}>
      <PageHeading>Blog</PageHeading>
      <NewPostLink />
    </PostList>
  );
}
