import { defineProject } from 'vitest/config';

/** Pure app modules only (no React Native imports): settings, formatting, media paths. */
export default defineProject({
  test: {
    name: 'mobile',
    include: ['src/**/*.test.ts'],
  },
});
