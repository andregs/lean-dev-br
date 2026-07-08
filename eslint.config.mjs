import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import nx from '@nx/eslint-plugin';
import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url));

const TS_JS_FILES = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.mts',
  '**/*.cts',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
];

/**
 * Shared, workspace-wide flat ESLint config. Per-project `eslint.config.mjs`
 * files import this `baseConfig` and append only their own overrides, so the
 * strict ruleset is configured once and reused across every app/lib.
 */
export default [
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
  // typescript-eslint's own configs include an unscoped "base" entry that sets
  // @typescript-eslint/parser for every file with no `files` filter — harmless
  // while the workspace was TS/JS-only, but it clobbers Angular's html template
  // parser once .html enters the mix. Scope explicitly per typescript-eslint's
  // own guidance for mixed-language configs. Uses tseslint.config() (not a plain
  // `extends:` object) — typescript-eslint's own configs aren't type-compatible
  // with eslint/config's `defineConfig` extends shape.
  ...tseslint.config({
    files: TS_JS_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  }),

  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],

  {
    // Scoped to TS/JS: typescript-eslint's projectService doesn't apply to Angular's
    // .html templates (those are linted by @angular-eslint/template-parser instead,
    // wired per-project); a global block here would misfire on them.
    files: TS_JS_FILES,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },

  {
    // Deliberately excludes .mts/.cts (vite.config.mts et al.) — pre-existing scope,
    // unrelated to the Angular/.mts type-info fix above.
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
  ...tseslint.config({
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  }),
];
