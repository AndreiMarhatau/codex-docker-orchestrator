module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: ['eslint:recommended'],
  plugins: ['vitest'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs'
  },
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: { sourceType: 'module' }
    },
    {
      files: ['tests/**/*.mjs'],
      env: { node: true },
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
    'prefer-const': 'error'
  }
};
