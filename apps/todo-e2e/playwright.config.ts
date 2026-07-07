import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd, retries, traceMode } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 4201;

// base: '/todo/' in vite.config.ts → app lives at /todo/ on both local and prod.
export const todoPath = (route: string) => `/todo${route === '/' ? '/' : route}`;

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
        command: 'pnpm nx run todo:dev',
        url: `http://localhost:${String(LOCAL_PORT)}/todo/`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
