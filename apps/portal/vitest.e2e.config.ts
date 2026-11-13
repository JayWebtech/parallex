import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Runs against a live stack: E2E_BASE_URL (default http://localhost:8080). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['test/e2e/**/*.e2e.test.ts'],
    testTimeout: 30_000,
    // Suites share one stack (e.g. the enrollment mode switch): run files one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
