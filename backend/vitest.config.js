const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.js'],
      thresholds: {
        branches: 80,
        lines: 80,
        functions: 80,
        statements: 80
      }
    }
  }
});
