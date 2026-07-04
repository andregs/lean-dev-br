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

// Dev: each remote runs its own Vite dev server on its own port. Prod: all three
// apps are same-origin behind one CloudFront distribution under /labs/federation/,
// so a relative path resolves to the right bucket via the edge routing.
const remoteEntry = (name: string, devPort: string) => ({
  type: 'module' as const,
  name,
  entry:
    process.env.NODE_ENV === 'production'
      ? `/labs/federation/${name}/remoteEntry.js`
      : `http://localhost:${devPort}/labs/federation/${name}/remoteEntry.js`,
  entryGlobalName: name,
  shareScope: 'default',
});

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/federation-shell',
  base: '/labs/federation/',
  server: {
    port: 4203,
    host: 'localhost',
    headers: devHeaders,
  },
  preview: {
    port: 4203,
    host: 'localhost',
    headers: previewHeaders,
    // Production is same-origin behind one CloudFront distribution — this proxy
    // reproduces that locally so `nx preview federation-shell` (with catalog and
    // cart also running their own preview servers) can be tested and e2e'd
    // under the real same-origin topology instead of three separate ports.
    // Scoped to each remote's actual asset files (assets/*, remoteEntry.js) only
    // — NOT the bare /labs/federation/catalog or /cart path, which must fall
    // through to the shell so a direct navigation/refresh there still renders
    // the shell's own routed page instead of that remote's standalone entry.
    proxy: {
      '/labs/federation/catalog/assets': { target: 'http://localhost:4204', changeOrigin: true },
      '/labs/federation/catalog/remoteEntry.js': {
        target: 'http://localhost:4204',
        changeOrigin: true,
      },
      '/labs/federation/cart/assets': { target: 'http://localhost:4205', changeOrigin: true },
      '/labs/federation/cart/remoteEntry.js': {
        target: 'http://localhost:4205',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    federation({
      // Cross-remote type generation only works with a live remote dev server
      // (consumeTypes always fetches over HTTP, no local-file fallback — see
      // apps/federation-shell/src/federation-remotes.d.ts for the CI/cold-build
      // fallback). Real types kick in automatically under `nx serve`.
      dts: true,
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        catalog: remoteEntry('catalog', '4204'),
        cart: remoteEntry('cart', '4205'),
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
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'federation-shell',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // No unit tests here by design: app.tsx lazy-loads federated remotes over the
    // network (mirrors ui-modulith, which likewise only unit-tests components with
    // real logic like DemoBar, not its own thin app.tsx/routes.tsx). Covered by e2e.
    passWithNoTests: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/federation-shell',
      provider: 'v8' as const,
    },
  },
}));
