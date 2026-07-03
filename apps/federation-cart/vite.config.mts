/// <reference types='vitest' />
import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dependencies } from '../../package.json';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/federation-cart',
  base: '/labs/federation/cart/',
  server: {
    port: 4205,
    host: 'localhost',
  },
  preview: {
    port: 4205,
    host: 'localhost',
  },
  plugins: [
    federation({
      dts: true,
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: {
        './Routes': './src/routes.tsx',
      },
      shared: {
        '@lean-dev-br/federation-kernel': { singleton: true },
        react: { requiredVersion: dependencies.react, singleton: true },
        'react-dom': { requiredVersion: dependencies['react-dom'], singleton: true },
        'react-router-dom': { requiredVersion: dependencies['react-router-dom'], singleton: true },
      },
    }),
    react(),
  ],
  build: {
    target: 'chrome89',
    outDir: '../../dist/apps/federation-cart',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'federation-cart',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/federation-cart',
      provider: 'v8' as const,
    },
  },
}));
