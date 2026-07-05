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
  beforeSend: (item: { type: string }) => unknown;
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

  it('samples non-exception items at the configured rate', async () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { initObservability } = await import('./index.js');
    initObservability(flagsWith(true), meta);
    const config = initializeFaro.mock.calls[0][0] as CapturedConfig;
    expect(config.beforeSend({ type: 'log' })).toBeNull(); // 0.5 >= NON_ERROR_SAMPLE_RATE (0.15)
    spy.mockRestore();
  });
});
