import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/flags',
  test: {
    name: 'flags',
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/flags',
      provider: 'v8',
    },
  },
});
