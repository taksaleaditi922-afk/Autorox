import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts on purpose: a compiled vite.config.js is
// committed in this repo and Vite resolves .js before .ts, so test settings
// placed in vite.config.ts would be ignored. vitest.config.ts always wins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
