import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd, retries, traceMode } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 4206;

export default defineConfig({
  testDir: './src',
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
        command: 'pnpm nx run wanderlust-web:serve',
        url: `http://localhost:${String(LOCAL_PORT)}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
