import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'tools/*', 'apps/mobile'],
    // Coverage is enforced for the pure engine only (100%, see CLAUDE.md).
    coverage: {
      provider: 'v8',
      include: ['packages/engine/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
