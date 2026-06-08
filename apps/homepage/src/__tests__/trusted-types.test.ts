// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// apex wires the shared @lean-dev-br/trusted-types lib with its reCAPTCHA
// script-URL allowlist. The policy mechanism itself is covered in the lib's
// own tests; here we assert apex's specific wiring and re-exports.
interface PolicyRules {
  createScriptURL?: (s: string) => string;
}

const policies = new Map<string, PolicyRules>();

function makeTrustedTypesMock() {
  return {
    createPolicy: vi.fn((name: string, rules: PolicyRules) => {
      policies.set(name, rules);
      return { name, ...rules };
    }),
  };
}

describe('apex trusted-types wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    policies.clear();
    vi.stubGlobal('trustedTypes', makeTrustedTypesMock());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const load = () => import('../trusted-types.js');

  it('app policy allows reCAPTCHA URLs, blocks arbitrary ones', async () => {
    const { policy } = await load();
    expect(policy.createScriptURL('https://www.google.com/recaptcha/api.js?render=key')).toContain(
      'recaptcha',
    );
    expect(policy.createScriptURL('https://www.gstatic.com/recaptcha/x.js')).toContain('recaptcha');
    expect(() => policy.createScriptURL('https://evil.com/p.js')).toThrow(TypeError);
  });

  it('re-exports a sanitizing setHTML', async () => {
    const { setHTML } = await load();
    const el = document.createElement('div');
    setHTML(el, '<p>safe</p><script>evil()</script>');
    expect(el.innerHTML).toContain('<p>safe</p>');
    expect(el.innerHTML).not.toContain('<script>');
  });
});
