// @ts-check
import { describe, it, expect, vi } from 'vitest';
import { hlcNow, hlcCompare } from './hlc.js';

describe('hlcNow', () => {
  it('returns a valid HLC string', () => {
    const h = hlcNow();
    expect(h.split('-')).toHaveLength(3);
  });

  it('successive calls produce ascending values', () => {
    const a = hlcNow();
    const b = hlcNow(a);
    expect(hlcCompare(b, a)).toBe(1);
  });

  it('same wallMs: increments counter', () => {
    const t = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(t);
    const last = hlcNow();
    const next = hlcNow(last);
    const [, counter] = next.split('-');
    expect(Number(counter)).toBe(1);
    vi.restoreAllMocks();
  });

  it('skewed clock: uses lastHlc wallMs and increments counter', () => {
    const futureMs = Date.now() + 60_000;
    // construct a lastHlc in the future
    const lastHlc = `${String(futureMs).padStart(13, '0')}-00003-xxxx`;
    const next = hlcNow(lastHlc);
    const [wallPart, counterPart] = next.split('-');
    expect(Number(wallPart)).toBe(futureMs);
    expect(Number(counterPart)).toBe(4);
  });
});

describe('hlcCompare', () => {
  it('a < b returns -1', () => {
    expect(hlcCompare('0001749600000-00000-aaaa', '0001749600001-00000-aaaa')).toBe(-1);
  });

  it('a > b returns 1', () => {
    expect(hlcCompare('0001749600001-00000-aaaa', '0001749600000-00000-aaaa')).toBe(1);
  });

  it('equal strings returns 0', () => {
    const h = hlcNow();
    expect(hlcCompare(h, h)).toBe(0);
  });

  it('counter tiebreaks within same wallMs', () => {
    const a = '0001749600000000-00000-aaaa';
    const b = '0001749600000000-00001-aaaa';
    expect(hlcCompare(a, b)).toBe(-1);
    expect(hlcCompare(b, a)).toBe(1);
  });
});
