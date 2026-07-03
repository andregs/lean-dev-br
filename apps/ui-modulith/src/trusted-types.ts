import { installPolicies } from '@lean-dev-br/trusted-types';

// MSW's service worker registration (navigator.serviceWorker.register) is a
// Trusted Types script-URL sink. It's called with the same relative URL string
// passed to worker.start() — not resolved to absolute — so allowlist that form.
export const policy = installPolicies({
  scriptUrlAllowlist: ['/labs/ui-modulith/'],
});
