import { describe, it, expect } from 'vitest';
import { createFlagClient, parseOverrides } from './index.js';
import type { FlagsJson } from './index.js';

const fixture: FlagsJson = {
  flags: {
    'my-feature': {
      state: 'ENABLED',
      variants: { on: true, off: false },
      defaultVariant: 'off',
    },
    'always-on': {
      state: 'ENABLED',
      variants: { on: true, off: false },
      defaultVariant: 'on',
    },
    'disabled-flag': {
      state: 'DISABLED',
      variants: { on: true, off: false },
      defaultVariant: 'on',
    },
    'string-flag': {
      state: 'ENABLED',
      variants: { a: 'variant-a', b: 'variant-b' },
      defaultVariant: 'a',
    },
  },
};

describe('createFlagClient.getBooleanValue', () => {
  it('returns the defaultVariant value', () => {
    const client = createFlagClient(fixture);
    expect(client.getBooleanValue('my-feature', true)).toBe(false);
    expect(client.getBooleanValue('always-on', false)).toBe(true);
  });

  it('returns defaultValue for unknown flag', () => {
    const client = createFlagClient(fixture);
    expect(client.getBooleanValue('unknown', true)).toBe(true);
    expect(client.getBooleanValue('unknown', false)).toBe(false);
  });

  it('returns defaultValue when flag is DISABLED regardless of defaultVariant', () => {
    const client = createFlagClient(fixture);
    expect(client.getBooleanValue('disabled-flag', false)).toBe(false);
  });

  it('override wins over flags.json value', () => {
    const client = createFlagClient(fixture, { overrides: { 'my-feature': true } });
    expect(client.getBooleanValue('my-feature', false)).toBe(true);
  });

  it('override false wins over an always-on flag', () => {
    const client = createFlagClient(fixture, { overrides: { 'always-on': false } });
    expect(client.getBooleanValue('always-on', true)).toBe(false);
  });
});

describe('createFlagClient.getStringValue', () => {
  it('returns the string variant', () => {
    const client = createFlagClient(fixture);
    expect(client.getStringValue('string-flag', 'default')).toBe('variant-a');
  });

  it('returns defaultValue for a boolean flag (type mismatch)', () => {
    const client = createFlagClient(fixture);
    expect(client.getStringValue('always-on', 'fallback')).toBe('fallback');
  });
});

describe('parseOverrides', () => {
  it('parses on → true', () => {
    expect(parseOverrides('?ff_my-feature=on')).toEqual({ 'my-feature': true });
  });

  it('parses off → false', () => {
    expect(parseOverrides('?ff_my-feature=off')).toEqual({ 'my-feature': false });
  });

  it('parses true/false aliases', () => {
    expect(parseOverrides('?ff_a=true&ff_b=false')).toEqual({ a: true, b: false });
  });

  it('ignores non-ff_ params', () => {
    expect(parseOverrides('?foo=bar&ff_flag=on')).toEqual({ flag: true });
  });

  it('returns empty object for empty search string', () => {
    expect(parseOverrides('')).toEqual({});
  });

  it('passes through arbitrary string values', () => {
    expect(parseOverrides('?ff_theme=dark')).toEqual({ theme: 'dark' });
  });

  it('skips clear entries (removes from storage side-effect, not included in result)', () => {
    const result = parseOverrides('?ff_gone=clear');
    expect('gone' in result).toBe(false);
  });
});
