import { defineConfig } from 'vitest/config';
import { cspHeader, trustedTypesDirective } from '@lean-dev-br/csp';

const serveHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'dev' }),
  'Content-Security-Policy-Report-Only': trustedTypesDirective(),
};
const previewHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'prod' }),
};

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/todo',
  base: '/todo/',
  server: {
    port: 4201,
    host: 'localhost',
    headers: serveHeaders,
  },
  preview: {
    port: 4301,
    host: 'localhost',
    headers: previewHeaders,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
  test: {
    name: 'todo',
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/todo',
      provider: 'v8',
    },
  },
});
