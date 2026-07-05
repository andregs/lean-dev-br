// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// Same-origin path — proxied by CloudFront to the Grafana Faro collector so
// telemetry survives ad blockers / ITP that target known collector hostnames
// (see infra/homepage/hosting.ts `/o11y/*` behavior).
const COLLECTOR_URL = '/o11y/collect';

// Session sampling stays at 1 (never drop a whole session) because Faro's
// built-in sessionTracking.samplingRate is all-or-nothing per session — a low
// rate there would silently drop error signals for most sessions. Instead,
// beforeSend samples non-error signals per-item so JS errors are always kept.
const NON_ERROR_SAMPLE_RATE = 0.15;

let initialized = false;

/**
 * Initialize Grafana Faro, gated behind the `observability-faro` flag so the
 * SDK ships dark and can be killed instantly (flags.json edit, no redeploy)
 * if it misbehaves in real browsers.
 * @param {FlagClient} flags
 */
export function initObservability(flags) {
  if (initialized) return;
  if (!flags.getBooleanValue('observability-faro', false)) return;
  initialized = true;

  try {
    initializeFaro({
      url: COLLECTOR_URL,
      app: {
        name: 'homepage',
        version: import.meta.env.VITE_APP_VERSION ?? 'dev',
        environment: import.meta.env.MODE,
      },
      sessionTracking: { samplingRate: 1 },
      beforeSend: (item) =>
        item.type === 'exception' || Math.random() < NON_ERROR_SAMPLE_RATE ? item : null,
      instrumentations: [...getWebInstrumentations(), new TracingInstrumentation()],
      // No router lib — routing is manual pushState dispatch (see main.js).
      // trackNavigation makes Faro capture URL changes and navigation timing.
      experimental: { trackNavigation: true },
    });
  } catch (err) {
    // Non-fatal: the site works without Faro.
    console.warn('Faro init failed (non-fatal):', err);
  }
}
