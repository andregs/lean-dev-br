'use client';
import { installPolicies } from '@lean-dev-br/trusted-types';
import { useEffect } from 'react';

// Registers the shared Trusted Types policies on the client. Uses the 'framework'
// default policy (pass-through createHTML/createScript): React 19's RSC client
// materializes <script> nodes via innerHTML, so a sanitizing default would crash
// it. Script URLs stay allowlisted to Next's same-origin chunks. TT is enforced
// in prod (CloudFront); dev ships it report-only.
//
// Two forms are allowlisted: the initial page load's own <script> tags resolve
// to the absolute origin-prefixed URL, but Turbopack's client-side chunk loader
// (used for route transitions, e.g. clicking into a tag page) passes the raw
// relative path straight to the script-URL sink instead.
export function TrustedTypesBoot() {
  useEffect(() => {
    try {
      installPolicies({
        scriptUrlAllowlist: [`${window.location.origin}/blog/_next/`, '/blog/_next/'],
        defaultPolicy: 'framework',
      });
    } catch (err) {
      // Policies can only be created once per document; ignore Fast Refresh re-runs.
      console.debug('Trusted Types already installed:', err);
    }
  }, []);
  return null;
}
