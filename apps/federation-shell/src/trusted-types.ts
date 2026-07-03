import { installPolicies } from '@lean-dev-br/trusted-types';

// MSW's service worker registration (navigator.serviceWorker.register) is a
// Trusted Types script-URL sink, called with the same relative URL string
// passed to worker.start(). The MF2 runtime's dynamic <script> tags for
// remoteEntry.js/shared chunks are also script-URL sinks — same-origin under
// /labs/federation/ in production, so one prefix covers both.
export const policy = installPolicies({
  scriptUrlAllowlist: ['/labs/federation/'],
});
