// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface PolicyRules {
  createHTML?: (s: string) => string;
  createScript?: (s: string) => string;
  createScriptURL?: (s: string) => string;
}

// Capture every policy the module registers, keyed by name, so we can assert on
// the named `app` policy and the strict-functional `default` separately.
const policies = new Map<string, PolicyRules>();

function makeTrustedTypesMock() {
  return {
    createPolicy: vi.fn((name: string, rules: PolicyRules) => {
      policies.set(name, rules);
      return { name, ...rules };
    }),
  };
}

describe('trusted-types policies', () => {
  beforeEach(() => {
    vi.resetModules();
    policies.clear();
    // In the jsdom env window === globalThis, so this also satisfies the
    // module's `window.trustedTypes` access and tinyfill check.
    vi.stubGlobal('trustedTypes', makeTrustedTypesMock());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function load() {
    return import('../trusted-types.js');
  }

  it('registers app, default policies', async () => {
    await load();
    expect(policies.has('app')).toBe(true);
    expect(policies.has('default')).toBe(true);
  });

  it('app.createScriptURL allows reCAPTCHA URLs', async () => {
    await load();
    const app = policies.get('app');
    const url = 'https://www.google.com/recaptcha/api.js?render=key';
    expect(app?.createScriptURL?.(url)).toBe(url);
    expect(app?.createScriptURL?.('https://www.gstatic.com/recaptcha/x.js')).toBe(
      'https://www.gstatic.com/recaptcha/x.js',
    );
  });

  it('app.createScriptURL blocks arbitrary URLs', async () => {
    await load();
    const app = policies.get('app');
    expect(() => app?.createScriptURL?.('https://evil.com/p.js')).toThrow(TypeError);
  });

  it('default.createScript always throws', async () => {
    await load();
    const def = policies.get('default');
    expect(() => def?.createScript?.('alert(1)')).toThrow(TypeError);
  });

  it('default.createScriptURL allowlists (debug-logged, no warn)', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await load();
    const def = policies.get('default');
    expect(def?.createScriptURL?.('https://www.google.com/recaptcha/x')).toBe(
      'https://www.google.com/recaptcha/x',
    );
    expect(debug).toHaveBeenCalled();
    expect(() => def?.createScriptURL?.('https://evil.com/x')).toThrow(TypeError);
  });

  it('default.createHTML warns and sanitizes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await load();
    const def = policies.get('default');
    const out = def?.createHTML?.('<p>ok</p><script>evil()</script>');
    expect(String(out)).not.toContain('<script>');
    expect(warn).toHaveBeenCalled();
  });

  it('setHTML strips script tags', async () => {
    const { setHTML } = await load();
    const el = document.createElement('div');
    setHTML(el, '<p>safe</p><script>evil()</script>');
    expect(el.innerHTML).not.toContain('<script>');
    expect(el.innerHTML).toContain('<p>safe</p>');
  });
});
