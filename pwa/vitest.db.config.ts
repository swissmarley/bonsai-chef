import { defineConfig } from 'vitest/config';

// Database tests: a throwaway local Postgres with every migration applied (`npm run test:db`).
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    globalSetup: ['tests/db/global-setup.ts'],
    setupFiles: ['tests/db/setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
