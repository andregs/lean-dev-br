import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'contact-api:bundle',
    environment: 'node',
    include: ['src/**/*.bundle.test.ts'],
    reporters: ['default'],
  },
});
