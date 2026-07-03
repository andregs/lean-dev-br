/// <reference types='vitest' />
import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cspHeader } from '@lean-dev-br/csp';
import { dependencies } from '../../package.json';

const devHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'dev', app: 'federation' }),
};

// preview serves the real production build, so it must send the prod CSP —
// otherwise Trusted Types violations only ever show up after a real deploy.
const previewHeaders = {
  'Content-Security-Policy': cspHeader({ mode: 'prod', app: 'federation' }),
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/federation-catalog',
  base: '/labs/federation/catalog/',
  server: {
    port: 4204,
    host: 'localhost',
    headers: devHeaders,
  },
  preview: {
    port: 4204,
    host: 'localhost',
    headers: previewHeaders,
  },
  plugins: [
    federation({
      // dts.tsConfigPath defaults to ./tsconfig.json (the project-root config,
      // which has no `include`), not tsconfig.app.json — so its isolated compile
      // can't resolve CSS-module ambient types (@nx/react/typings/cssmodule.d.ts).
      dts: { tsConfigPath: './tsconfig.app.json' },
      name: 'catalog',
      filename: 'remoteEntry.js',
      exposes: {
        './Routes': './src/routes.tsx',
      },
      shared: {
        '@lean-dev-br/federation-kernel': { singleton: true },
        react: { requiredVersion: dependencies.react, singleton: true },
        'react-dom': { requiredVersion: dependencies['react-dom'], singleton: true },
        'react-router-dom': { requiredVersion: dependencies['react-router-dom'], singleton: true },
        i18next: { requiredVersion: dependencies.i18next, singleton: true },
        'react-i18next': { requiredVersion: dependencies['react-i18next'], singleton: true },
      },
    }),
    react(),
  ],
  build: {
    target: 'chrome89',
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
    setupFiles: ['src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/federation-catalog',
      provider: 'v8' as const,
    },
  },
}));
