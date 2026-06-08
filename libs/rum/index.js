// Single source of truth for the AWS CloudWatch RUM web-client config, shared
// by the apex homepage and the blog. Structural config lives here; each app
// passes its own env-injected identifiers (VITE_RUM_* / NEXT_PUBLIC_RUM_*).

const REGION = 'us-east-1';
const APP_VERSION = '1.0.0';

/**
 * @param {{ appMonitorId?: string, identityPoolId?: string, sampleRate?: number, region?: string }} opts
 * @returns {{ appMonitorId: string, appVersion: string, region: string, config: Record<string, unknown> } | null}
 *   `null` when required config is missing, so callers skip init cleanly.
 */
export function rumConfig({ appMonitorId, identityPoolId, sampleRate, region = REGION }) {
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

export { REGION, APP_VERSION };
