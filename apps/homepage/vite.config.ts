import { defineConfig } from 'vitest/config';
import { cspHeader, trustedTypesDirective } from '@lean-dev-br/csp';

// Dev server: same prod CSP sources + localhost/HMR, but Trusted Types in
// report-only so Vite's HMR/overlay tooling isn't blocked while we still see
// violations. Preview (built app) mirrors prod exactly with TT enforced.
const serveHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'dev' }),
  'Content-Security-Policy-Report-Only': trustedTypesDirective(),
};
const previewHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'prod' }),
};

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/homepage',
  server: {
    headers: serveHeaders,
    // Proxy sub-apps so all share one origin during development.
    proxy: {
      '/blog': { target: 'http://localhost:3001', changeOrigin: true, ws: true },
      '/todo': { target: 'http://localhost:4201', changeOrigin: true, ws: true },
    },
  },
  preview: { headers: previewHeaders },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    sourcemap: true,
  },
  test: {
    name: 'homepage',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/homepage',
      provider: 'v8',
    },
  },
});
