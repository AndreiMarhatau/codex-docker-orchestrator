module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true
  },
  extends: ['eslint:recommended'],
  plugins: ['react', 'vitest'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  settings: {
    react: { version: 'detect' }
  },
  overrides: [
    {
      files: ['tests/**/*.{js,jsx}'],
      env: { browser: true, node: true },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly'
      }
    }
  ],
  rules: {
    'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [
      'error',
      { max: 130, skipBlankLines: true, skipComments: true }
    ],
    'max-params': ['error', 4],
    'max-lines-per-class': ['error', 200],
    complexity: ['error', 20],
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
    'no-duplicate-imports': 'error',
    'no-shadow': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-const': 'error',
    'react/jsx-uses-vars': 'error'
  }
};
