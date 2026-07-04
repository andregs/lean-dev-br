// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { violationKey, reportViolation } from '../observer.js';

function makeBody(effectiveDirective = '', blockedURL = ''): ReportBody {
  return { effectiveDirective, blockedURL };
}

function makeReport(type: string, effectiveDirective = '', blockedURL = ''): Report {
  return { type, body: makeBody(effectiveDirective, blockedURL) };
}

describe('violationKey', () => {
  it('builds a stable key from type, directive, and URL', () => {
    const key = violationKey('csp-violation', makeBody('script-src', 'https://evil.com'));
    expect(key).toBe('csp-violation|script-src|https://evil.com');
  });

  it('handles missing fields gracefully', () => {
    expect(violationKey('trusted-types-policy', makeBody())).toBe('trusted-types-policy||');
  });
});

describe('reportViolation', () => {
  let sent: Set<string>;
  let beacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sent = new Set();
    beacon = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends beacon on first violation and returns true', () => {
    const result = reportViolation(
      makeReport('csp-violation', 'script-src', 'https://evil.com'),
      sent,
    );
    expect(result).toBe(true);
    expect(beacon).toHaveBeenCalledOnce();
  });

  it('skips duplicate via in-memory Set and returns false', () => {
    const report = makeReport('csp-violation', 'script-src', 'https://evil.com');
    reportViolation(report, sent);
    expect(reportViolation(report, sent)).toBe(false);
    expect(beacon).toHaveBeenCalledOnce();
  });

  it('skips duplicate already in sessionStorage and returns false', () => {
    const report = makeReport('csp-violation', 'script-src', 'https://evil.com');
    sessionStorage.setItem('csp:' + violationKey(report.type, report.body), '1');
    expect(reportViolation(report, sent)).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });

  it('sends different violations independently', () => {
    reportViolation(makeReport('csp-violation', 'script-src', 'https://a.com'), sent);
    reportViolation(makeReport('csp-violation', 'img-src', 'https://b.com'), sent);
    expect(beacon).toHaveBeenCalledTimes(2);
  });

  it('beacon payload contains type, body, and url', () => {
    reportViolation(makeReport('csp-violation', 'script-src', 'https://evil.com'), sent);
    const [url, payload] = beacon.mock.calls[0] as [string, string];
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    expect(url).toBe('/api/csp-report');
    expect(parsed.type).toBe('csp-violation');
    expect(parsed.body).toBeTypeOf('object');
  });
});

describe('observer lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initObserver is a singleton — observe runs once across repeat calls', async () => {
    const observe = vi.fn();
    const ctor = vi.fn(function () {
      return { observe, disconnect: vi.fn() };
    });
    vi.stubGlobal('ReportingObserver', ctor);

    const mod = await import('../observer.js'); // import already calls initObserver once
    const first = mod.initObserver();
    const second = mod.initObserver();

    expect(first).toBe(second);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('disconnectObserver releases the instance and allows re-init', async () => {
    const disconnect = vi.fn();
    const ctor = vi.fn(function () {
      return { observe: vi.fn(), disconnect };
    });
    vi.stubGlobal('ReportingObserver', ctor);

    const mod = await import('../observer.js'); // ctor call #1 at import
    mod.disconnectObserver();
    expect(disconnect).toHaveBeenCalledOnce();

    mod.initObserver(); // ctor call #2 after release
    expect(ctor).toHaveBeenCalledTimes(2);
  });

  it('initObserver is a no-op without ReportingObserver support', async () => {
    vi.stubGlobal('ReportingObserver', undefined);
    const mod = await import('../observer.js');
    expect(mod.initObserver()).toBeNull();
  });
});
