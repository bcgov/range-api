import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__testHelpers__/vitest-setup.js', './__testHelpers__/setup.js'],
    include: ['__tests__/**/*.spec.js'],
  },
});
