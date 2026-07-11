// Vitest configuration for QuickLLM
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files live alongside source or in a __tests__ directory
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    // Global setup to mock the WebExtension `browser` API
    setupFiles: ['./tests/setup.js'],
    environment: 'node',
  },
});
