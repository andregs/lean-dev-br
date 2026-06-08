import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/trusted-types',
  test: {
    name: 'trusted-types',
    environment: 'jsdom',
    include: ['**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/trusted-types',
      provider: 'v8',
    },
  },
});
