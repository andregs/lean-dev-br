// @ts-check
/** @import { FlagClient } from '@lean-dev-br/flags' */
/** @import { ObservabilityAppMeta } from './index.js' */
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// Same-origin path — proxied by CloudFront to the Grafana Faro collector so
// telemetry survives ad blockers / ITP that target known collector hostnames
// (see infra/homepage/hosting.ts `/o11y/*` behavior).
const COLLECTOR_URL = '/o11y/collect';

// No sampling for now — at this traffic, even 100% capture stays far under
// Grafana Cloud's free-tier ingest limits (measured ~270MB/mo worst-case),
// so a lower rate would only cost correlation with backend traces for no
// real savings. Revisit if traffic grows enough to matter. Tail sampling
// (buffer whole traces, keep only errors/slow ones) would be the properly
// scalable answer at higher volume, but needs a collector in the path we
// don't have — a good fit for the future k8s microservices demo, not this
// low-traffic site.
const NON_ERROR_SAMPLE_RATE = 1;

/**
 * Small deterministic string hash normalized to [0, 1) — the same trace/
 * session ID always maps to the same value, so every item belonging to one
 * trace gets the same keep/drop decision instead of an independent coin
 * flip per item (which produces partial, misleading traces).
 * @param {string} str
 * @returns {number}
 */
export function hashToUnitInterval(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  // Avalanche finalizer (Murmur3-style) — without this, IDs that differ only
  // in their last character (e.g. sequential trace IDs) land within a few
  // bits of each other instead of spreading across the output range.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

/**
 * The ID every item of the same trace/session shares: the trace ID for trace
 * items, otherwise the session ID (present on every item once session
 * tracking is on). Undefined only if session tracking somehow isn't active.
 * @param {any} item
 * @returns {string | undefined}
 */
function sampleKey(item) {
  return (
    item.payload?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]?.traceId ?? item.meta?.session?.id
  );
}

let initialized = false;

/**
 * @param {FlagClient} flags
 * @param {ObservabilityAppMeta} meta
 */
export function initObservability(
  flags,
  { appName, version, environment, propagateTraceHeaderCorsUrls, extraConfig = {} },
) {
  if (initialized) return;
  if (!flags.getBooleanValue('observability-faro', false)) return;
  initialized = true;

  try {
    initializeFaro({
      url: COLLECTOR_URL,
      app: { name: appName, version, environment },
      sessionTracking: { samplingRate: 1 },
      beforeSend: (item) => {
        if (item.type === 'exception') return item;
        const key = sampleKey(item);
        const sampled = key
          ? hashToUnitInterval(key) < NON_ERROR_SAMPLE_RATE
          : Math.random() < NON_ERROR_SAMPLE_RATE;
        return sampled ? item : null;
      },
      instrumentations: [
        ...getWebInstrumentations(),
        // propagateTraceHeaderCorsUrls only takes effect nested under
        // instrumentationOptions — passing it as a top-level Faro config key
        // (e.g. via extraConfig) is silently a no-op.
        //
        // app.name: homepage/blog/todo all share one Grafana Frontend
        // Observability app-key, so Grafana's ingest stamps service.name (and
        // Faro's own app.name resource attribute) to that shared app's name,
        // not ours — this survives as an independent, unclaimed attribute so
        // traces stay distinguishable per app.
        new TracingInstrumentation({
          resourceAttributes: { 'app.name': appName },
          ...(propagateTraceHeaderCorsUrls
            ? { instrumentationOptions: { propagateTraceHeaderCorsUrls } }
            : {}),
        }),
      ],
      ...extraConfig,
    });
  } catch (err) {
    // Non-fatal: the app works without Faro.
    console.warn('Faro init failed (non-fatal):', err);
  }
}
