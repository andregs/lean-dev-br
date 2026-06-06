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
          depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }],
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
