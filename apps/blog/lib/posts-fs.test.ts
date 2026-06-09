import { describe, expect, it } from 'vitest';
import { matchPostFilename } from './posts-fs';

const files = [
  '2026-06-07-hello-world.md',
  '2026-06-08-one-design-system.md',
  'README.txt',
  '.gitkeep',
];

describe('matchPostFilename', () => {
  it('resolves a slug to its dated filename', () => {
    expect(matchPostFilename(files, 'hello-world')).toBe('2026-06-07-hello-world.md');
    expect(matchPostFilename(files, 'one-design-system')).toBe('2026-06-08-one-design-system.md');
  });

  it('ignores non-markdown files', () => {
    expect(matchPostFilename(files, 'README')).toBeUndefined();
  });

  it('returns undefined for unknown or traversal slugs', () => {
    expect(matchPostFilename(files, 'nope')).toBeUndefined();
    expect(matchPostFilename(files, '../../package')).toBeUndefined();
  });
});
