import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  {
    // src/api/schema.d.ts is real, committed codegen output (openapi-typescript).
    // The rest are stray sibling .d.ts files written by Module Federation's
    // dts extractThirdParty step whenever an app pulls this lib in as a
    // `shared` dependency — never committed, but can reappear locally.
    ignores: ['src/api/schema.d.ts', 'src/index.d.ts', 'src/bus/*.d.ts', 'src/api/client.d.ts'],
  },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
];
