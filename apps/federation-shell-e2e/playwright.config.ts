import { defineConfig } from '@playwright/test';
import { baseUrl, browserProjects, isProd } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 4203;

export const labPath = (route: string) => `/labs/federation${route === '/' ? '/' : route}`;

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
  // Three separate preview servers, same as the real production topology: the
  // shell's own preview.proxy forwards catalog/cart's assets/remoteEntry.js
  // requests to their own preview ports, so tests only ever navigate against
  // localhost:4203 — matching how CloudFront routes all three same-origin.
  webServer: isProd()
    ? undefined
    : [
        {
          command: 'pnpm nx run federation-catalog:preview',
          url: 'http://localhost:4204/labs/federation/catalog/',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm nx run federation-cart:preview',
          url: 'http://localhost:4205/labs/federation/cart/',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'pnpm nx run federation-shell:preview',
          url: `http://localhost:${String(LOCAL_PORT)}/labs/federation/`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});
