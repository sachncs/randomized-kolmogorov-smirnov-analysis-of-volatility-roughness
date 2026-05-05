export default [
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],
      'max-len': ['warn', {code: 120, ignoreStrings: true, ignoreTemplateLiterals: true}],
      'indent': ['error', 2],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    ignores: ['dist/**', 'node_modules/**', 'demo/dist/**'],
  },
];