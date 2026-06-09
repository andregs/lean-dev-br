import { describe, expect, it } from 'vitest';
import { draftFilename, renderDraft, slugify, type DraftInput } from './draft';

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics, trims edges', () => {
    expect(slugify('  Hello, World! ')).toBe('hello-world');
    expect(slugify('One design system, two stacks')).toBe('one-design-system-two-stacks');
  });
});

describe('draftFilename', () => {
  it('prefixes the UTC date and slugified title', () => {
    expect(draftFilename('2026-06-08T15:30:00Z', 'Hello, World')).toBe('2026-06-08-hello-world.md');
  });
});

describe('renderDraft', () => {
  const base: DraftInput = {
    title: 'Title: with colon',
    date: '2026-06-08T15:30:00.000Z',
    tags: ['nextjs', 'csp'],
    description: 'a "quoted" desc',
    draft: true,
    body: '  Body text.  ',
  };

  it('escapes free-text frontmatter as quoted YAML scalars', () => {
    const md = renderDraft(base);
    expect(md).toContain('title: "Title: with colon"');
    expect(md).toContain('description: "a \\"quoted\\" desc"');
    expect(md).toContain('tags: ["nextjs", "csp"]');
  });

  it('includes draft:true only when drafting, and trims the body', () => {
    expect(renderDraft(base)).toContain('draft: true');
    expect(renderDraft({ ...base, draft: false })).not.toContain('draft:');
    expect(renderDraft(base)).toMatch(/---\n\nBody text\.\n$/);
  });

  it('omits description when empty', () => {
    expect(renderDraft({ ...base, description: undefined })).not.toContain('description:');
  });
});
