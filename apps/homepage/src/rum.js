// @ts-check
import { AwsRum } from 'aws-rum-web';

const APP_MONITOR_ID = import.meta.env.VITE_RUM_APP_MONITOR_ID;
const IDENTITY_POOL_ID = import.meta.env.VITE_RUM_IDENTITY_POOL_ID;
const SAMPLE_RATE = Number(import.meta.env.VITE_RUM_SESSION_SAMPLE_RATE);
const REGION = 'us-east-1';

if (APP_MONITOR_ID && IDENTITY_POOL_ID && Number.isFinite(SAMPLE_RATE)) {
  try {
    new AwsRum(APP_MONITOR_ID, '1.0.0', REGION, {
      sessionSampleRate: SAMPLE_RATE,
      identityPoolId: IDENTITY_POOL_ID,
      endpoint: `https://dataplane.rum.${REGION}.amazonaws.com`,
      telemetries: ['errors', 'performance'],
      allowCookies: false,
      enableXRay: false,
    });
  } catch (err) {
    // Non-fatal: the site works without RUM. Surface it so a misconfigured
    // monitor doesn't fail silently during development.
    console.warn('CloudWatch RUM init failed (non-fatal):', err);
  }
} else {
  console.warn("Can't init RUM - missing env arguments");
}
