import { defineConfig } from 'vitest/config';

// Standalone vitest config so the test runner never has to load the app.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
