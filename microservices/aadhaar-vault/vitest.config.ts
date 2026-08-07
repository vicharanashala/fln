import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Pin vitest's project root to this microservice so the `tests/**/*.test.ts`
  // glob resolves inside the vault rather than walking up to the repository
  // root (which would also pick up test files from @fln/backend, @fln/frontend,
  // and the npm workspace layout — a defense-in-depth boundary, not just a
  // test-discovery fix).
  root: here,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    reporters: 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/server.ts'],
    },
  },
});