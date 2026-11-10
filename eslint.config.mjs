import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Rules chosen because each one points at a real bug, not a style preference.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'backend/fln-backend/**', 'frontend/public/**', 'Research/**', '**/*.cjs', 'ai-services/**', 'FLN SVG HTML files*/**', 'mvp/**', 'scripts/**', 'backend/tests/dist/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  {
    files: ['backend/src/**/*.ts', 'backend/tests/**/*.ts', 'frontend/src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, globals: { ...globals.node, ...globals.browser } },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    rules: {
      'no-dupe-keys': 'error', 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error',
      'no-unreachable': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error',
      'no-cond-assign': 'error', 'no-compare-neg-zero': 'error', 'no-sparse-arrays': 'error',
      'no-unsafe-finally': 'error', 'no-unsafe-negation': 'error', 'use-isnan': 'error',
      'valid-typeof': 'error', 'no-case-declarations': 'error', 'no-fallthrough': 'error',
      'no-empty-pattern': 'error', 'no-prototype-builtins': 'error', 'no-useless-catch': 'error',
      'no-loss-of-precision': 'error', 'no-async-promise-executor': 'error',
      'no-misleading-character-class': 'error', 'no-unsafe-optional-chaining': 'error',
      'no-debugger': 'error', 'no-dupe-class-members': 'error',
      'require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
);
