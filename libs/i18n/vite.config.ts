import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/i18n',
  test: {
    name: 'i18n',
    environment: 'node',
    include: ['**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/i18n',
      provider: 'v8',
    },
  },
});
