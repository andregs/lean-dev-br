# E2E Testing Setup

Playwright 1.61.0 smoke tests across three per-app projects (`homepage-e2e`, `blog-e2e`, `todo-e2e`), sharing utilities from `libs/e2e-support`.

## Browser policy

`last 2 Chrome versions, last 2 Firefox versions, last 2 Safari versions, last 2 Edge versions` (see `browserslist` in root `package.json`). This matches the Playwright browser bundle pinned to `@playwright/test@1.61.0` (Chromium 149 / Firefox 151 / WebKit 26.5). Upgrading test browsers = bump `@playwright/test` version + re-run `playwright install`.

## Install (one-time, per machine)

```bash
pnpm install
pnpm exec playwright install --with-deps chromium firefox webkit
```

`--with-deps` pulls OS-level libs via apt. Supported on Ubuntu 26.04 (WSL2). Browsers land in `~/.cache/ms-playwright`. Always use `pnpm exec playwright`, never `npx playwright`.

## Running locally

```bash
# Single project (starts its own dev server automatically):
pnpm nx run homepage-e2e:e2e
pnpm nx run blog-e2e:e2e
pnpm nx run todo-e2e:e2e

# Only affected projects (fast on PRs):
pnpm nx affected -t e2e

# All three at once:
pnpm nx run-many -t e2e
```

Each project's `playwright.config.ts` starts the relevant dev server if `E2E_BASE_URL` is not set.

## Test tags

| Tag          | Meaning                              | When run                            |
| ------------ | ------------------------------------ | ----------------------------------- |
| `@prod-safe` | Read-only, no writes, no auth needed | CI (local) + nightly monitor (prod) |
| `@dev-only`  | Requires dev server, may write files | CI (local) only                     |
| `@writes`    | Creates records on the server        | CI (local) only                     |

Nightly monitor uses `--grep @prod-safe` so only read-only specs run against production.

## Environment variables

| Variable       | Purpose                                              | Default                   |
| -------------- | ---------------------------------------------------- | ------------------------- |
| `E2E_BASE_URL` | Override base URL                                    | `http://localhost:<port>` |
| `E2E_FULL`     | Enable full browser matrix (Firefox, WebKit, mobile) | unset (Chromium only)     |

Setting `E2E_BASE_URL=https://lean.dev.br` switches to prod mode: `isProd()` returns true, webServers are not started, and `blogPath()` uses the `/blog` prefix.

## Mocking

- **reCAPTCHA** — `page.route('**/recaptcha/api.js**', ...)` returns a stub `grecaptcha` object; `/api/contact` is intercepted to return 200. No source-code change needed.
- **WebAuthn PRF** — Playwright 1.61's `context.credentials` virtual authenticator does not implement the PRF extension. The todo app uses `addInitScript` to mock `navigator.credentials.create/get` with a synthetic PRF output (deterministic 32-byte key material), so `deriveAesKey()` succeeds and the session is saved to IndexedDB. On reload, `restoreSession()` reads the IDB directly and skips WebAuthn.

## Ports

| App      | Dev port | Base path                     |
| -------- | -------- | ----------------------------- |
| homepage | 5173     | `/`                           |
| blog     | 3001     | `/blog/` (Next.js `basePath`) |
| todo     | 4201     | `/todo/` (Vite `base`)        |

## Local dev server topology

Each e2e project starts **its own per-app dev server** on a fixed port (see table above). There is no single-origin proxy for local runs — this means cross-app navigation (e.g. homepage linking into `/blog`) is not exercised by e2e locally. The prod monitor covers that path via the real domain.

## CI / CD

Three workflows govern the project:

| Workflow                | Trigger                                         | What it does                                                             |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `ci.yml`                | Push to any branch except `main`; PRs to `main` | `nx affected -t lint typecheck test build e2e` — Chromium only, mocked   |
| `main.yml`              | Push to `main`; `workflow_dispatch`             | Same verify step, then **affected-only deploys** gated on verify success |
| `synthetic-monitor.yml` | Nightly 10:00 UTC; `workflow_dispatch`          | All engines + mobile, `--grep @prod-safe` against `https://lean.dev.br`  |

**Deploy gate**: `deploy-frontend` and `deploy-relay` jobs in `main.yml` have `needs: verify` — a red verify commit lands on `main` but never reaches production. Fix the failing tests, push again.

**Affected-only deploys**: `main.yml` computes `nx show projects --affected` and skips the deploy job if no relevant project changed. Pulumi `up` is idempotent regardless — a re-deploy of an unchanged stack is a safe no-op.

Playwright browsers cached by `pnpm-lock.yaml` hash. Report uploaded as artifact on failure (7-day retention). System dependencies (`install-deps`) run unconditionally; only the browser binaries are cache-gated.

## Debugging failures

```bash
# Interactive UI mode — call Playwright directly (bypasses Nx executor):
# PLAYWRIGHT_TRACING_NO_WEBSOCKET_FRAMES=1 workaround required until 1.62.0 stable
# (fix merged June 19 2026, tracked at github.com/microsoft/playwright/issues/41351)
PLAYWRIGHT_TRACING_NO_WEBSOCKET_FRAMES=1 pnpm exec playwright test --config apps/blog-e2e/playwright.config.ts --ui

# Headed mode — browser visible, results printed to terminal:
pnpm exec playwright test --config apps/blog-e2e/playwright.config.ts --headed

# Show last run trace (on-first-retry):
pnpm exec playwright show-trace apps/homepage-e2e/test-results/**/trace.zip

# Show HTML report:
pnpm exec playwright show-report apps/homepage-e2e/playwright-report

# Step-by-step debugger (requires display; works with WSLg):
PWDEBUG=1 pnpm exec playwright test --config apps/homepage-e2e/playwright.config.ts --headed
```
