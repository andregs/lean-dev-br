import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
