import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cspHeader } from '@lean-dev-br/csp';

const devHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'dev', app: 'ui-modulith' }),
};

// preview serves the real production build, so it must send the prod CSP —
// otherwise Trusted Types violations only ever show up after a real deploy.
const previewHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'prod', app: 'ui-modulith' }),
};

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/ui-modulith',
  base: '/labs/ui-modulith/',
  server: {
    port: 4202,
    host: 'localhost',
    headers: devHeaders,
  },
  preview: {
    port: 4202,
    host: 'localhost',
    headers: previewHeaders,
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'ui-modulith',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,mts,tsx}'],
    setupFiles: ['src/mocks/setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/ui-modulith',
      provider: 'v8',
    },
  },
});
