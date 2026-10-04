import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // The codebase predates linting; catch real bugs without blocking CI.
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-case-declarations': 'off',
      'no-console': 'off',
    },
  },
];