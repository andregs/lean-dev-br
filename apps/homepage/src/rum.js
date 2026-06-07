// @ts-check
import { AwsRum } from 'aws-rum-web';
import { rumConfig } from '@lean-dev-br/rum';

// Structural config lives in @lean-dev-br/rum (single source of truth shared
// with the blog); only the env-injected identifiers are wired in here.
const rum = rumConfig({
  appMonitorId: import.meta.env.VITE_RUM_APP_MONITOR_ID,
  identityPoolId: import.meta.env.VITE_RUM_IDENTITY_POOL_ID,
  sampleRate: Number(import.meta.env.VITE_RUM_SESSION_SAMPLE_RATE),
});

if (rum) {
  try {
    new AwsRum(rum.appMonitorId, rum.appVersion, rum.region, rum.config);
  } catch (err) {
    // Non-fatal: the site works without RUM. Surface it so a misconfigured
    // monitor doesn't fail silently during development.
    console.warn('CloudWatch RUM init failed (non-fatal):', err);
  }
} else {
  console.warn("Can't init RUM - missing env arguments");
}
