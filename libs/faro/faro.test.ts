import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlagClient } from '@lean-dev-br/flags';

const initializeFaro = vi.fn();
vi.mock('@grafana/faro-web-sdk', () => ({
  initializeFaro,
  getWebInstrumentations: () => [],
}));
vi.mock('@grafana/faro-web-tracing', () => ({
  TracingInstrumentation: vi.fn(),
}));

function flagsWith(on: boolean): FlagClient {
  return { getBooleanValue: () => on } as unknown as FlagClient;
}

interface CapturedConfig {
  sessionTracking: { samplingRate: number };
  beforeSend: (item: {
    type: string;
    meta?: { session?: { id?: string } };
    payload?: { resourceSpans?: { scopeSpans?: { spans?: { traceId?: string }[] }[] }[] };
  }) => unknown;
}

/** Builds a trace-type item whose sampling key is the given traceId. */
function traceItem(traceId: string) {
  return {
    type: 'trace',
    payload: { resourceSpans: [{ scopeSpans: [{ spans: [{ traceId }] }] }] },
  };
}

/** Builds a non-trace item (e.g. a log) keyed only by session ID. */
function sessionItem(sessionId: string) {
  return { type: 'log', meta: { session: { id: sessionId } } };
}

const meta = { appName: 'homepage', version: '1.0.0', environment: 'production' };

describe('initObservability', () => {
  beforeEach(() => {
    initializeFaro.mockClear();
    vi.resetModules();
  });

  it('does not init Faro while the flag is off', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(false), meta);
    expect(initializeFaro).not.toHaveBeenCalled();
  });

  it('initializes Faro once the flag is on, tagged with the caller app meta', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    expect(initializeFaro).toHaveBeenCalledTimes(1);
    expect(initializeFaro).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/o11y/collect',
        app: { name: 'homepage', version: '1.0.0', environment: 'production' },
      }),
    );
  });

  it('merges caller-supplied extraConfig (e.g. trackNavigation for no-router apps)', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), {
      ...meta,
      extraConfig: { experimental: { trackNavigation: true } },
    });
    expect(initializeFaro).toHaveBeenCalledWith(
      expect.objectContaining({ experimental: { trackNavigation: true } }),
    );
  });

  it('only initializes once even if called again with the flag on', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    initObservability(flagsWith(true), meta);
    expect(initializeFaro).toHaveBeenCalledTimes(1);
  });

  it('never drops a whole session, and always keeps exception items regardless of sample rate', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    const config = initializeFaro.mock.calls[0][0] as CapturedConfig;
    expect(config.sessionTracking).toEqual({ samplingRate: 1 });
    expect(config.beforeSend({ type: 'exception' })).toEqual({ type: 'exception' });
  });

  it('falls back to Math.random when no trace/session ID is derivable', async () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    const config = initializeFaro.mock.calls[0][0] as CapturedConfig;
    config.beforeSend({ type: 'log' });
    expect(spy).toHaveBeenCalled(); // exercises the no-key fallback path
    spy.mockRestore();
  });

  it('gives every item of the same trace the same keep/drop decision (no partial traces)', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    const config = initializeFaro.mock.calls[0][0] as CapturedConfig;

    const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    const decisions = Array.from({ length: 5 }, () => config.beforeSend(traceItem(traceId)));
    // Every call with the same trace ID must agree — all kept or all dropped.
    expect(decisions.every((d) => d !== null)).toBe(decisions[0] !== null);
  });

  it('gives every item of the same session the same keep/drop decision', async () => {
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    const config = initializeFaro.mock.calls[0][0] as CapturedConfig;

    const sessionId = 'session-xyz';
    const decisions = Array.from({ length: 5 }, () => config.beforeSend(sessionItem(sessionId)));
    expect(decisions.every((d) => d !== null)).toBe(decisions[0] !== null);
  });

  it('hashToUnitInterval spreads sequential IDs across the output range', async () => {
    // Regression: an earlier version of this hash barely moved on a 1-char
    // difference (e.g. "trace-0" vs "trace-1" landed within 1e-9 of each
    // other), so sequential IDs collapsed into a handful of buckets instead
    // of spreading out — any rate below 1.0 would then keep either ~all or
    // ~none of a sequential ID range instead of a representative sample.
    const { hashToUnitInterval } = await import('./index.js');
    const values = Array.from({ length: 500 }, (_, i) => hashToUnitInterval(`trace-${String(i)}`));
    const buckets = new Set(values.map((v) => Math.floor(v * 10))); // 10 deciles
    expect(buckets.size).toBeGreaterThan(5); // spread across most deciles, not clumped
  });
});
