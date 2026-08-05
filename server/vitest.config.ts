import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // All test files share one throwaway Postgres database.
    fileParallelism: false,
    globalSetup: ['test/global-setup.ts'],
    env: {
      JWT_SECRET: 'test-secret-not-for-production',
    },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
