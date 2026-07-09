/**
 * Resolves the base URL for e2e tests.
 * Mirrors the env-var-with-fallback convention used across all apps.
 *
 * Local / CI (PR):   http://localhost:<port>   (default per app)
 * Nightly prod run:  E2E_BASE_URL=https://lean.dev.br
 */
export function baseUrl(defaultLocalPort: number): string {
  return process.env.E2E_BASE_URL ?? `http://localhost:${String(defaultLocalPort)}`;
}

/** True when targeting a live environment (no webServer needed, read-only flows only). */
export function isProd(): boolean {
  return process.env.E2E_BASE_URL?.startsWith('https://') ?? false;
}

/** True when the full browser matrix (all engines + mobile) is enabled. */
export function fullMatrix(): boolean {
  return Boolean(process.env.E2E_FULL);
}

/**
 * Retries for the current run. Auto-retry is opt-in via E2E_FLAKE_RETRY, set only
 * by ci.yml and synthetic-monitor.yml — it exists to *detect* flakes (retried-then-
 * passed is flagged, not silently swallowed), not to paper over real failures.
 * main.yml never sets it: a red main.yml must mean something real.
 */
export function retries(): number {
  return process.env.E2E_FLAKE_RETRY ? 2 : 0;
}

/** Trace capture mode. CI and prod always keep a trace on failure for diagnosis,
 * since a red run there can't be reproduced interactively; locally, only
 * first-retry traces are worth the disk cost. */
export function traceMode(): 'retain-on-failure' | 'on-first-retry' {
  return isProd() || Boolean(process.env.CI) ? 'retain-on-failure' : 'on-first-retry';
}
