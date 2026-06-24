import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  {
    plugins: { '@next/next': nextEslintPluginNext },
    rules: nextEslintPluginNext.configs['recommended'].rules,
  },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    // Generated output: Next build dir, static export, and Velite content.
    ignores: ['.next/**/*', 'out/**/*', '.velite/**/*'],
  },
];
