// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
/** @import { ObservabilityAppMeta } from './index.js' */
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// Same-origin path — proxied by CloudFront to the Grafana Faro collector so
// telemetry survives ad blockers / ITP that target known collector hostnames
// (see infra/homepage/hosting.ts `/o11y/*` behavior).
const COLLECTOR_URL = '/o11y/collect';

// Representative sample of perf/session signals; errors are always kept.
// Faro's built-in sessionTracking.samplingRate is all-or-nothing per session
// (a low rate would drop error signals for most sessions too) — beforeSend
// samples non-error items individually instead, so errors are never dropped.
const NON_ERROR_SAMPLE_RATE = 0.15;

let initialized = false;

/**
 * @param {FlagClient} flags
 * @param {ObservabilityAppMeta} meta
 */
export function initObservability(flags, { appName, version, environment, extraConfig = {} }) {
  if (initialized) return;
  if (!flags.getBooleanValue('observability-faro', false)) return;
  initialized = true;

  try {
    initializeFaro({
      url: COLLECTOR_URL,
      app: { name: appName, version, environment },
      sessionTracking: { samplingRate: 1 },
      beforeSend: (item) =>
        item.type === 'exception' || Math.random() < NON_ERROR_SAMPLE_RATE ? item : null,
      instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
      ...extraConfig,
    });
  } catch (err) {
    // Non-fatal: the app works without Faro.
    console.warn('Faro init failed (non-fatal):', err);
  }
}
