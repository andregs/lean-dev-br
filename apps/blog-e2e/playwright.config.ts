import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd } from '@lean-dev-br/e2e-support';

export const LOCAL_PORT = 3001;

// basePath '/blog' in next.config.js applies in both local dev and prod.
export const blogPath = (route: string) => `/blog${route === '/' ? '' : route}`;

export default defineConfig({
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  testDir: './e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
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
        command: 'pnpm nx run blog:dev',
        url: `http://localhost:${String(LOCAL_PORT)}/blog`,
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
