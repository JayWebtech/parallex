import { defineConfig } from 'vitest/config';

/** Network-dependent: downloads filter lists. Kept out of the default (offline) test run. */
export default defineConfig({
  test: {
    include: ['test/adblock.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 600_000,
  },
});
