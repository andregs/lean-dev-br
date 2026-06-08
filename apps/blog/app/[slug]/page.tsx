import { notFound } from 'next/navigation';
import { allPosts, getPost } from '../../lib/posts';
import { formatDate } from '../../lib/format';

export function generateStaticParams() {
  return allPosts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <article className="post">
      <header>
        <h1>{post.title}</h1>
        {post.draft && <span className="draft-badge">DRAFT</span>}
        <time dateTime={post.date}>{formatDate(post.date)}</time>
      </header>
      {/* Build-time HTML compiled from our own markdown (Velite + rehype-highlight). */}
      <div className="post-body" dangerouslySetInnerHTML={{ __html: post.html }} />
    </article>
  );
}
