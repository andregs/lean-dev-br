import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/ui-modulith/kernel',
  plugins: [react()],
  test: {
    name: 'kernel',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,mts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/ui-modulith/kernel',
      provider: 'v8',
    },
  },
});
