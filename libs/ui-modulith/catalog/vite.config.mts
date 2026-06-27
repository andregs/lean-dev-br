import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/ui-modulith/catalog',
  plugins: [react()],
  test: {
    name: 'catalog',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,mts,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/ui-modulith/catalog',
      provider: 'v8',
    },
  },
});
