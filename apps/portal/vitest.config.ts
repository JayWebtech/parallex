import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
    hookTimeout: 60_000,
  },
});
