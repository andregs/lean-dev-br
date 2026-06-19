import type { Metadata } from 'next';
import { PostList } from '../../PostList';
import { PageHeading } from '../../PageHeading';
import { allPostsFor } from '../../../lib/posts';
import { BLOG_DESCRIPTION } from '../../../lib/site';

export const metadata: Metadata = {
  description: BLOG_DESCRIPTION,
};

export default function PtBRBlogIndex() {
  return (
    <PostList posts={allPostsFor('pt-BR')} makeHref={(s) => `/pt-BR/${s}/`}>
      <PageHeading>Blog</PageHeading>
    </PostList>
  );
}
