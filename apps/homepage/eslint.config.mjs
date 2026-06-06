import globals from 'globals';
import baseConfig from '../../eslint.config.mjs';

/** Homepage runs in the browser — expose DOM globals to the shipped vanilla JS. */
export default [
  ...baseConfig,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];
