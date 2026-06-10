'use client';
import { rumConfig } from '@lean-dev-br/rum';
import { AwsRum } from 'aws-rum-web';

// Per aws-rum-web's React guidance, instantiate once at module scope — once per
// document load — not in a useEffect (React StrictMode double-invokes effects).
// This 'use client' module is also evaluated during SSG, so guard for the browser.
// A global flag keeps it to a single instance across Fast Refresh re-evaluations.
// apex and blog are separate documents (hard nav between / and /blog), so only one
// AwsRum ever exists per page; they share the same app monitor via env ids.
declare global {
  var __rumStarted: boolean | undefined;
}

if (typeof window !== 'undefined' && !globalThis.__rumStarted) {
  const rum = rumConfig({
    appMonitorId: process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID,
    identityPoolId: process.env.NEXT_PUBLIC_RUM_IDENTITY_POOL_ID,
    sampleRate: Number(process.env.NEXT_PUBLIC_RUM_SESSION_SAMPLE_RATE),
  });
  if (rum) {
    globalThis.__rumStarted = true;
    try {
      // Auto page views ride the History API, which Next's client router drives,
      // so SPA navigations are captured without manual recordPageView.
      new AwsRum(rum.appMonitorId, rum.appVersion, rum.region, rum.config);
    } catch (err) {
      // Non-fatal: the blog works without RUM.
      console.warn('CloudWatch RUM init failed (non-fatal):', err);
    }
  }
}

// Mounted in the layout purely to pull this module into the client bundle.
export function RumBoot() {
  return null;
}
