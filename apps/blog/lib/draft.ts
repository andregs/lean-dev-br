// Pure helpers for the dev-only authoring page: turn editor fields into a
// content/posts/*.md filename + file body. No fs/Velite import, so unit-testable.

export interface DraftInput {
  title: string;
  date: string;
  tags: string[];
  description?: string;
  draft: boolean;
  body: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `YYYY-MM-DD-slug.md` — the date prefix mirrors the existing posts. */
export function draftFilename(date: string, title: string): string {
  const day = new Date(date).toISOString().slice(0, 10);
  return `${day}-${slugify(title)}.md`;
}

// JSON double-quoted scalars are valid YAML, so this safely escapes colons,
// quotes, etc. in free-text frontmatter values.
function yaml(value: string): string {
  return JSON.stringify(value);
}

export function renderDraft(input: DraftInput): string {
  const frontmatter = [`title: ${yaml(input.title)}`, `date: ${input.date}`];
  if (input.description) frontmatter.push(`description: ${yaml(input.description)}`);
  frontmatter.push(`tags: [${input.tags.map(yaml).join(', ')}]`);
  if (input.draft) frontmatter.push('draft: true');

  return `---\n${frontmatter.join('\n')}\n---\n\n${input.body.trim()}\n`;
}
