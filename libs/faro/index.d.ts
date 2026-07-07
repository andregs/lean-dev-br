import type { FlagClient } from '@lean-dev-br/flags';

export interface ObservabilityAppMeta {
  appName: string;
  version: string;
  environment: string | undefined;
  /** Cross-origin URLs to attach the W3C traceparent header to (Faro only propagates it same-origin by default). */
  propagateTraceHeaderCorsUrls?: (string | RegExp)[];
  /** Extra initializeFaro config to merge in — e.g. `{ experimental: { trackNavigation: true } }` for apps with no router. */
  extraConfig?: Record<string, unknown>;
}

/**
 * Initialize Grafana Faro, gated behind the `observability-faro` flag so the
 * SDK ships dark and can be killed instantly (flags.json edit, no redeploy)
 * if it misbehaves in real browsers. Shared by every app so the flag-gate,
 * sampling, and instrumentation set can't drift between them.
 */
export function initObservability(flags: FlagClient, meta: ObservabilityAppMeta): void;

/** Exported for testing the hash's distribution quality independent of the currently-configured sample rate. */
export function hashToUnitInterval(str: string): number;
