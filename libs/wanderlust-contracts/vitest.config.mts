import { defineConfig } from 'vitest/config';

// nxViteTsPaths/nxCopyAssetsPlugin are deprecated (Nx v24 removal); this lib has no
// cross-package imports in its own tests and ships no assets, so no replacement plugin needed.
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/wanderlust-contracts',
  plugins: [],
  test: {
    name: 'wanderlust-contracts',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/wanderlust-contracts',
      provider: 'v8' as const,
    },
  },
}));
