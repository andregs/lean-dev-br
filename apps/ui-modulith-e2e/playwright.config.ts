import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 4202;

export const labPath = (route: string) => `/labs/ui-modulith${route === '/' ? '/' : route}`;

export default defineConfig({
  testDir: './src',
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
        command: 'pnpm nx run ui-modulith:preview',
        url: `http://localhost:${String(LOCAL_PORT)}/labs/ui-modulith/`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
