module.exports = {
  extends: ['google', 'prettier'],
  env: {
    node: true,
    es2022: true,
    browser: true,
    worker: true,
    mocha: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  globals: {
    Plotly: 'readonly',
  },
  rules: {
    // Prettier handles formatting; disable conflicting rules
    'max-len': 'off',
    indent: 'off',
    quotes: 'off',
    'comma-dangle': 'off',
    semi: 'off',
    'block-spacing': 'off',
    'brace-style': 'off',
    'object-curly-spacing': 'off',
    'array-bracket-spacing': 'off',
    'space-before-function-paren': 'off',
    'space-before-blocks': 'off',
    'keyword-spacing': 'off',
    'arrow-parens': 'off',
    'operator-linebreak': 'off',
    'function-paren-newline': 'off',
    'implicit-arrow-linebreak': 'off',
    'no-confusing-arrow': 'off',
    'no-trailing-spaces': 'off',

    // Google style overrides
    'require-jsdoc': [
      'error',
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
    'valid-jsdoc': [
      'warn',
      {
        requireReturn: false,
        requireReturnType: true,
        requireParamType: true,
        requireParamDescription: false,
      },
    ],
    'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
  },
  overrides: [
    {
      files: ['tests/**/*.js', 'tests/**/*.tests.js'],
      rules: {
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off',
        'no-invalid-this': 'off',
      },
    },
    {
      files: ['experiments/**/*.js'],
      rules: {
        'require-jsdoc': 'off',
        'valid-jsdoc': 'off',
        'no-console': 'off',
      },
    },
  ],
};
