import { defineConfig, defineCollection, s } from 'velite';
import rehypeHighlight from 'rehype-highlight';

// Posts live as markdown under content/posts/ named `YYYY-MM-DD-slug.md`. The
// date prefix gives natural ordering + filename uniqueness; the URL slug strips
// it for clean paths. Frontmatter `date` is authoritative for sorting.
const posts = defineCollection({
  name: 'Post',
  pattern: 'posts/**/*.md',
  schema: s
    .object({
      title: s.string(),
      date: s.isodate(),
      description: s.string().optional(),
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      path: s.path(),
      html: s.markdown(),
    })
    .transform((data) => {
      const file = data.path.split('/').pop() ?? data.path;
      return { ...data, slug: file.replace(/^\d{4}-\d{2}-\d{2}-/, '') };
    }),
});

export default defineConfig({
  root: 'content',
  output: {
    data: '.velite',
    clean: true,
  },
  collections: { posts },
  markdown: {
    rehypePlugins: [rehypeHighlight],
  },
});
