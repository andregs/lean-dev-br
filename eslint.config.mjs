import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Shared, workspace-wide flat ESLint config. Per-project `eslint.config.mjs`
 * files import this `baseConfig` and append only their own overrides, so the
 * strict ruleset is configured once and reused across every app/lib.
 */
export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/node_modules',
    '**/.nx',
    '**/vite.config.*.timestamp*',
    '**/*.timestamp-*',
    '**/playwright-report/**',
    '**/test-results/**',
    // Vitest 4 + Vite 8 regression: Vitest sets build.outDir to this sentinel
    // expecting it to stay virtual (emptyOutDir: false), but Vite 8/Rolldown
    // creates it on disk anyway. https://github.com/vitest-dev/vitest/issues/10617
    '**/dummy-non-existing-folder/**',
    // Module Federation dts-consume output: generated .d.ts for federated
    // remote modules, written by the build, outside any tsconfig include.
    '**/@mf-types/**',
    // CloudFront Function scripts run in a restricted CF runtime — not workspace JS
    'infra/homepage/cloudfront-edge.js',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  nx.configs['flat/base'],
  nx.configs['flat/typescript'],
  nx.configs['flat/javascript'],

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
            // ui-modulith boundary enforcement: direction + no feature→feature + entry-point-only
            {
              sourceTag: 'type:shell',
              onlyDependOnLibsWithTags: ['type:feature', 'type:kernel', 'scope:shared'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:kernel', 'scope:shared'],
            },
            { sourceTag: 'type:kernel', onlyDependOnLibsWithTags: ['scope:shared'] },
            {
              sourceTag: 'domain:catalog',
              onlyDependOnLibsWithTags: ['domain:catalog', 'type:kernel', 'scope:shared'],
            },
            {
              sourceTag: 'domain:cart',
              onlyDependOnLibsWithTags: ['domain:cart', 'type:kernel', 'scope:shared'],
            },
          ],
        },
      ],
    },
  },

  // Plain JS ships untranspiled and is type-checked by `tsc` (the typecheck
  // target), not by ESLint — disable type-aware rules on JS to avoid noise.
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
]);
