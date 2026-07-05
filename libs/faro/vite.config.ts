import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/faro',
  test: {
    name: 'faro',
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/faro',
      provider: 'v8',
    },
  },
});
