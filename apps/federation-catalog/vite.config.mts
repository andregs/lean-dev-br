/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/federation-catalog',
  base: '/labs/federation/catalog/',
  server: {
    port: 4204,
    host: 'localhost',
  },
  preview: {
    port: 4204,
    host: 'localhost',
  },
  plugins: [react()],
  build: {
    outDir: '../../dist/apps/federation-catalog',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'federation-catalog',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/federation-catalog',
      provider: 'v8' as const,
    },
  },
}));
