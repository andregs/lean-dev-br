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
