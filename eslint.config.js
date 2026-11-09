import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// No suppressions file: every rule violation is fixed, not hidden.
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'release/**', 'Research/**', 'data/**', 'assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  // CommonJS files (the startup file loaded with `node --require`): require() is how they work.
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  // Browser code: the landing pages and the web app.
  { files: ['landing/**/*.js', 'apps/web/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser } } },
);
