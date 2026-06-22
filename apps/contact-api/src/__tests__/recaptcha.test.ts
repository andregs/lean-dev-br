import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyToken } from '../recaptcha.js';

const ARGS = [
  'token',
  'secret',
  'contact',
  0.5,
  'https://www.google.com/recaptcha/api/siteverify',
] as const;

function mockFetch(body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }));
}

describe('verifyToken', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('throws shape error when success field is missing', async () => {
    mockFetch({ foo: 'bar' });
    await expect(verifyToken(...ARGS)).rejects.toThrow('Unexpected siteverify response shape');
  });

  it('throws with error-codes when Google returns success: false', async () => {
    mockFetch({ success: false, 'error-codes': ['invalid-input-response'] });
    await expect(verifyToken(...ARGS)).rejects.toThrow('invalid-input-response');
  });

  it('throws with "unknown" when success: false has no error-codes', async () => {
    mockFetch({ success: false });
    await expect(verifyToken(...ARGS)).rejects.toThrow('unknown');
  });

  it('throws shape error when success: true but score/action missing', async () => {
    mockFetch({ success: true });
    await expect(verifyToken(...ARGS)).rejects.toThrow('missing score or action');
  });

  it('throws on action mismatch', async () => {
    mockFetch({ success: true, score: 0.9, action: 'other' });
    await expect(verifyToken(...ARGS)).rejects.toThrow('action=other');
  });

  it('throws on score below minimum', async () => {
    mockFetch({ success: true, score: 0.2, action: 'contact' });
    await expect(verifyToken(...ARGS)).rejects.toThrow('score=0.2');
  });

  it('returns result on valid response', async () => {
    mockFetch({ success: true, score: 0.9, action: 'contact' });
    await expect(verifyToken(...ARGS)).resolves.toEqual({
      success: true,
      score: 0.9,
      action: 'contact',
    });
  });
});
