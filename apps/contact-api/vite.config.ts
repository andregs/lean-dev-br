import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'contact-api',
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    reporters: ['default'],
    coverage: { reportsDirectory: '../../coverage/contact-api', provider: 'v8' },
  },
});
