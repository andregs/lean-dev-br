import { describe, expect, it } from 'vitest';
import { parseOtlpHeaders } from '../otel.js';

describe('parseOtlpHeaders', () => {
  it('returns an empty object when unset', () => {
    expect(parseOtlpHeaders(undefined)).toEqual({});
  });

  it('percent-decodes values (regression: Basic auth header space)', () => {
    expect(parseOtlpHeaders('Authorization=Basic%20dGVzdDp0b2tlbg==')).toEqual({
      Authorization: 'Basic dGVzdDp0b2tlbg==',
    });
  });

  it('parses multiple comma-separated pairs', () => {
    expect(parseOtlpHeaders('Authorization=Basic%20abc,X-Scope-OrgID=tenant1')).toEqual({
      Authorization: 'Basic abc',
      'X-Scope-OrgID': 'tenant1',
    });
  });

  it('ignores malformed pairs with no "="', () => {
    expect(parseOtlpHeaders('not-a-pair,Authorization=Basic%20abc')).toEqual({
      Authorization: 'Basic abc',
    });
  });
});
