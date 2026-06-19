import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd } from '@lean-dev-br/e2e-support';

// Vite default dev port (no explicit port in apps/homepage/vite.config.ts)
const LOCAL_PORT = 5173;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: baseUrl(LOCAL_PORT),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: browserProjects(),
  webServer: isProd()
    ? undefined
    : {
        command: 'pnpm nx run homepage:dev',
        url: `http://localhost:${String(LOCAL_PORT)}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
