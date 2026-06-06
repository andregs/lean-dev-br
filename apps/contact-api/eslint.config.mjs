import baseConfig from '../../eslint.config.mjs';
import tseslint from 'typescript-eslint';

export default [
  ...baseConfig,
  // jsonc-eslint-parser can't provide type information — disable type-aware rules for JSON.
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.json'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
