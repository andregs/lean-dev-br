// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPolicies, makeScriptUrlAsserter, setHTML } from './index.js';

interface PolicyRules {
  createHTML?: (s: string) => string;
  createScript?: (s: string) => string;
  createScriptURL?: (s: string) => string;
}

// Capture every policy the lib registers so we can assert on `app` vs `default`.
const policies = new Map<string, PolicyRules>();

function makeTrustedTypesMock() {
  return {
    createPolicy: vi.fn((name: string, rules: PolicyRules) => {
      policies.set(name, rules);
      return { name, ...rules };
    }),
  };
}

const ALLOW = ['https://cdn.example.com/'];

describe('@lean-dev-br/trusted-types', () => {
  beforeEach(() => {
    policies.clear();
    vi.stubGlobal('trustedTypes', makeTrustedTypesMock());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('installPolicies registers app + default', () => {
    installPolicies({ scriptUrlAllowlist: ALLOW });
    expect(policies.has('app')).toBe(true);
    expect(policies.has('default')).toBe(true);
  });

  it('app.createScriptURL allows allowlisted prefixes, blocks others', () => {
    const app = installPolicies({ scriptUrlAllowlist: ALLOW });
    expect(app.createScriptURL('https://cdn.example.com/x.js')).toBe('https://cdn.example.com/x.js');
    expect(() => app.createScriptURL('https://evil.com/x.js')).toThrow(TypeError);
  });

  it('default.createScript always throws', () => {
    installPolicies({ scriptUrlAllowlist: ALLOW });
    expect(() => policies.get('default')?.createScript?.('alert(1)')).toThrow(TypeError);
  });

  it('default.createHTML warns and sanitizes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installPolicies({ scriptUrlAllowlist: ALLOW });
    const out = policies.get('default')?.createHTML?.('<p>ok</p><script>evil()</script>');
    expect(String(out)).not.toContain('<script>');
    expect(warn).toHaveBeenCalled();
  });

  it('setHTML sanitizes before assigning', () => {
    const el = document.createElement('div');
    setHTML(el, '<p>safe</p><script>evil()</script>');
    expect(el.innerHTML).toContain('<p>safe</p>');
    expect(el.innerHTML).not.toContain('<script>');
  });

  it('makeScriptUrlAsserter enforces prefixes', () => {
    const assert = makeScriptUrlAsserter(ALLOW);
    expect(assert('https://cdn.example.com/a')).toBe('https://cdn.example.com/a');
    expect(() => assert('https://x.com/a')).toThrow(TypeError);
  });
});
