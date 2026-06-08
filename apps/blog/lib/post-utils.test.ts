import { describe, expect, it } from 'vitest';
import { adjacent, collectTags, sortByDateDesc, visiblePosts, type PostLike } from './post-utils';

const post = (slug: string, date: string, extra: Partial<PostLike> = {}): PostLike => ({
  slug,
  date,
  draft: false,
  tags: [],
  ...extra,
});

const fixtures: PostLike[] = [
  post('a', '2026-01-01', { tags: ['x'] }),
  post('c', '2026-03-01', { tags: ['x', 'y'] }),
  post('b', '2026-02-01', { tags: ['y'], draft: true }),
];

describe('sortByDateDesc', () => {
  it('orders newest first without mutating input', () => {
    const ordered = sortByDateDesc(fixtures);
    expect(ordered.map((p) => p.slug)).toEqual(['c', 'b', 'a']);
    expect(fixtures.map((p) => p.slug)).toEqual(['a', 'c', 'b']);
  });
});

describe('visiblePosts', () => {
  it('drops drafts in production but keeps them in dev', () => {
    expect(visiblePosts(fixtures, false).map((p) => p.slug)).toEqual(['a', 'c']);
    expect(visiblePosts(fixtures, true)).toHaveLength(3);
  });
});

describe('adjacent', () => {
  const ordered = sortByDateDesc(fixtures); // c, b, a

  it('returns newer as next and older as prev', () => {
    expect(adjacent(ordered, 'b')).toMatchObject({ next: { slug: 'c' }, prev: { slug: 'a' } });
  });

  it('omits a neighbour at the ends and returns empty for unknown slug', () => {
    expect(adjacent(ordered, 'c').next).toBeUndefined();
    expect(adjacent(ordered, 'a').prev).toBeUndefined();
    expect(adjacent(ordered, 'nope')).toEqual({});
  });
});

describe('collectTags', () => {
  it('returns unique sorted tags', () => {
    expect(collectTags(fixtures)).toEqual(['x', 'y']);
  });
});
