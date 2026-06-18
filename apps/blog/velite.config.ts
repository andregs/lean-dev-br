import { defineConfig, defineCollection, s } from 'velite';
import rehypeHighlight from 'rehype-highlight';

// Posts live as markdown under content/posts/{locale}/ named `YYYY-MM-DD-slug.md`.
// The date prefix gives natural ordering + filename uniqueness; the URL slug
// strips it for clean paths. Frontmatter `date` is authoritative for sorting.
// `locale` is derived from the parent directory name (en → en-US, pt-BR → pt-BR).
// The slug is shared across locales — the same story in two languages has the
// same slug, which drives hreflang linking and the EN-fallback logic.
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
      const segments = data.path.split('/');
      const file = segments.pop() ?? data.path;
      const dir = segments.pop() ?? 'en';
      const locale = dir === 'pt-BR' ? 'pt-BR' : 'en-US';
      return { ...data, slug: file.replace(/^\d{4}-\d{2}-\d{2}-/, ''), locale };
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
    // Build-time syntax highlighting. rehype-highlight wraps highlight.js (via
    // lowlight): it tokenizes fenced code by its ```lang hint and emits standard,
    // language-agnostic `hljs-*` classes — no inline styles, so the CSP stays
    // strict. Only the ~35 "common" languages are registered and auto-detect is
    // off; register more via this plugin's `languages` option. Token colours are
    // themed in apps/blog/app/global.scss.
    // Refs: https://github.com/rehypejs/rehype-highlight  https://highlightjs.org/
    rehypePlugins: [rehypeHighlight],
  },
});
