import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'contact-api-integration',
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    reporters: ['default'],
    hookTimeout: 120_000,
  },
});
