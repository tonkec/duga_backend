module.exports = {
  root: true,
  env: {
    commonjs: true,
    es2021: true,
    jest: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-unused-vars': 'warn',
  },
};
