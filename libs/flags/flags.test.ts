import { describe, it, expect } from 'vitest';
import { createFlagClient } from './index.js';
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
  it('returns the defaultVariant value', async () => {
    const client = await createFlagClient(fixture);
    expect(client.getBooleanValue('my-feature', true)).toBe(false);
    expect(client.getBooleanValue('always-on', false)).toBe(true);
  });

  it('returns defaultValue for unknown flag', async () => {
    const client = await createFlagClient(fixture);
    expect(client.getBooleanValue('unknown', true)).toBe(true);
    expect(client.getBooleanValue('unknown', false)).toBe(false);
  });

  it('returns defaultValue when flag is DISABLED regardless of defaultVariant', async () => {
    const client = await createFlagClient(fixture);
    expect(client.getBooleanValue('disabled-flag', false)).toBe(false);
  });
});

describe('createFlagClient.getStringValue', () => {
  it('returns the string variant', async () => {
    const client = await createFlagClient(fixture);
    expect(client.getStringValue('string-flag', 'default')).toBe('variant-a');
  });

  it('returns defaultValue for a boolean flag (type mismatch)', async () => {
    const client = await createFlagClient(fixture);
    expect(client.getStringValue('always-on', 'fallback')).toBe('fallback');
  });
});
