// Single source of truth for the AWS CloudWatch RUM web-client configuration.
//
// Consumed by both the vanilla-JS apex (apps/homepage/src/rum.js) and the
// TypeScript Next.js blog so the two never drift. Authored as plain CommonJS
// with no build step (same pattern as @lean-dev-br/csp) so it resolves
// identically under Vite (esbuild) and the Next.js bundler without tsconfig
// path or ESM/CJS gymnastics.
//
// The structural config (region, endpoint, telemetries, cookie/X-Ray policy)
// lives here. The per-app, env-injected identifiers (app monitor id, identity
// pool id, sample rate) are passed in by each caller — they stay in each app's
// own build-time env (VITE_RUM_* for apex, NEXT_PUBLIC_RUM_* for the blog).

const REGION = 'us-east-1';
const APP_VERSION = '1.0.0';

/**
 * Build the AwsRum constructor arguments from per-app identifiers. Returns
 * `null` when required config is missing so callers can skip init cleanly
 * (the site works without RUM — a missing monitor must not throw).
 *
 * @param {{ appMonitorId?: string, identityPoolId?: string, sampleRate?: number, region?: string }} opts
 * @returns {{ appMonitorId: string, appVersion: string, region: string, config: Record<string, unknown> } | null}
 */
function rumConfig({ appMonitorId, identityPoolId, sampleRate, region = REGION }) {
  if (!appMonitorId || !identityPoolId || !Number.isFinite(sampleRate)) {
    return null;
  }
  return {
    appMonitorId,
    appVersion: APP_VERSION,
    region,
    config: {
      sessionSampleRate: sampleRate,
      identityPoolId,
      endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
      telemetries: ['errors', 'performance'],
      allowCookies: false,
      enableXRay: false,
    },
  };
}

module.exports = { rumConfig, REGION, APP_VERSION };
