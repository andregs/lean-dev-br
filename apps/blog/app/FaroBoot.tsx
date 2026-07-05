'use client';
import { createFlagClient } from '@lean-dev-br/flags';
import type { FlagsJson } from '@lean-dev-br/flags';
import { initObservability } from '@lean-dev-br/faro';
import { useEffect } from 'react';

// Gated behind the observability-faro flag (default off) so Faro ships dark
// and can be killed instantly via flags.json — no redeploy — if it misbehaves.
// Fetches the domain-root flags.json (homepage's, not a per-app copy): it's
// the same origin, fetch() isn't basePath-aware, and this flag should roll
// out site-wide together rather than drift between two separate files.
export function FaroBoot() {
  useEffect(() => {
    fetch('/flags.json')
      .then((r) => r.json() as Promise<FlagsJson>)
      .then((flagsJson) => createFlagClient(flagsJson))
      .then((flags) => {
        initObservability(flags, {
          appName: 'blog',
          version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev',
          environment: process.env.NODE_ENV,
        });
      })
      .catch(() => {
        /* stay dark on any failure — no flags signal means no Faro */
      });
  }, []);
  return null;
}
