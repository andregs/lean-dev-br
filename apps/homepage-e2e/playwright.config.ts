import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd, retries, traceMode } from '@lean-dev-br/e2e-support';

// Vite default dev port (no explicit port in apps/homepage/vite.config.ts)
const LOCAL_PORT = 5173;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  retries: retries(),
  use: {
    baseURL: baseUrl(LOCAL_PORT),
    trace: traceMode(),
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: browserProjects(),
  webServer: isProd()
    ? undefined
    : {
        // VITE_RECAPTCHA_SITE_KEY must be non-empty so loadRecaptcha() passes its
        // guard check; the real Google endpoint is mocked via page.route() in specs.
        command: 'VITE_RECAPTCHA_SITE_KEY=test-e2e pnpm nx run homepage:dev',
        url: `http://localhost:${String(LOCAL_PORT)}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
