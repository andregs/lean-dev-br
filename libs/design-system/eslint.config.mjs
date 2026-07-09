import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Angular components with no inputs/methods (e.g. SiteFooter) are legitimately
    // decorator-only classes.
    files: ['angular/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
];
