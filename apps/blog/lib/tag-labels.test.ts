import { describe, expect, it } from 'vitest';
import { tagLabel } from './tag-labels';

describe('tagLabel', () => {
  it('translates known pt-BR tags', () => {
    expect(tagLabel('security', 'pt-BR')).toBe('segurança');
    expect(tagLabel('decisions', 'pt-BR')).toBe('decisões');
    expect(tagLabel('infrastructure', 'pt-BR')).toBe('infraestrutura');
  });

  it('returns the slug unchanged for en-US', () => {
    expect(tagLabel('security', 'en-US')).toBe('security');
    expect(tagLabel('infrastructure', 'en-US')).toBe('infrastructure');
  });

  it('passes untranslated tech terms through unchanged for both locales', () => {
    expect(tagLabel('nextjs', 'pt-BR')).toBe('nextjs');
    expect(tagLabel('nextjs', 'en-US')).toBe('nextjs');
    expect(tagLabel('aws', 'pt-BR')).toBe('aws');
  });
});
