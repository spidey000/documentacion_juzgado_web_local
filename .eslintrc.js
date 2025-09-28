module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Possible Errors
    'no-console': 'warn', // Allow console logs for debugging, but warn
    'no-debugger': 'error', // No debugger statements in production
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }], // Allow unused vars starting with underscore
    'no-undef': 'error', // No undefined variables
    
    // Best Practices
    'eqeqeq': ['error', 'always'], // Require === and !==
    'no-eval': 'error', // No eval()
    'no-implied-eval': 'error', // No implied eval()
    'no-new-func': 'error', // No new Function()
    'no-script-url': 'error', // No javascript: urls
    'no-with': 'error', // No with statement
    
    // Variables
    'no-var': 'error', // Use let or const instead of var
    'prefer-const': 'error', // Use const when possible
    
    // Stylistic Issues
    'indent': ['error', 2], // 2-space indentation
    'linebreak-style': ['error', 'unix'], // Unix linebreaks
    'quotes': ['error', 'single'], // Single quotes
    'semi': ['error', 'always'], // Require semicolons
    'comma-dangle': ['error', 'never'], // No trailing commas
    'max-len': ['warn', { 'code': 120 }], // Warn on lines longer than 120 characters
    
    // ES6
    'arrow-spacing': 'error', // Require spaces around arrow functions
    'no-confusing-arrow': 'error', // No confusing arrow functions
    'prefer-arrow-callback': 'error', // Prefer arrow callbacks
    'prefer-template': 'error', // Prefer template literals
    'template-curly-spacing': 'error', // Require spaces in template literals
    
    // Custom rules for this project
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
        contexts: [
          'MethodDefinition[kind=constructor]',
          'ClassProperty[value.type=FunctionExpression]',
        ],
      },
    ],
    'valid-jsdoc': [
      'error',
      {
        requireParamDescription: true,
        requireReturnDescription: true,
        requireReturnType: true,
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true,
      },
      rules: {
        'no-console': 'off', // Allow console in tests
      },
    },
  ],
  globals: {
    // PDF.js globals
    'pdfjsLib': 'readonly',
    'pdfjsWorker': 'readonly',
    
    // App globals (if any)
    '__APP_VERSION__': 'readonly',
    '__APP_NAME__': 'readonly',
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.min.js',
    'coverage/',
  ],
}