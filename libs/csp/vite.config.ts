import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/csp',
  test: {
    name: 'csp',
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/csp',
      provider: 'v8',
    },
  },
});
