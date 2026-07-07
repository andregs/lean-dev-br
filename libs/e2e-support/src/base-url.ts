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
 * Retries for the current run. Prod runs a live site over the internet and must
 * tolerate transient network blips; a lost race there should surface as flaky
 * (retried, then green), not a hard failure. Local/CI runs against a freshly
 * started dev server don't need it.
 */
export function retries(): number {
  return isProd() ? 2 : 0;
}

/** Trace capture mode. Prod always keeps a trace on failure for diagnosis, since
 * a red nightly run can't be reproduced interactively; locally, only first-retry
 * traces are worth the disk cost. */
export function traceMode(): 'retain-on-failure' | 'on-first-retry' {
  return isProd() ? 'retain-on-failure' : 'on-first-retry';
}
