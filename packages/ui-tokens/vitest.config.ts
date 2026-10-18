import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'ui-tokens',
    include: ['src/**/*.test.ts'],
  },
});
