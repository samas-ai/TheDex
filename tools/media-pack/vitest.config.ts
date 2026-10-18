import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'media-pack',
    include: ['src/**/*.test.ts'],
  },
});
