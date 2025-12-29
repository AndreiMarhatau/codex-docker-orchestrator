const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80
      }
    }
  }
});
