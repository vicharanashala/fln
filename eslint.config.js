import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// No suppressions file: every rule violation is fixed, not hidden.
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'Research/**', 'data/**', 'assets/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  // Browser code: the landing pages and the web app.
  { files: ['landing/**/*.js', 'apps/web/**/*.{ts,tsx}'], languageOptions: { globals: { ...globals.browser } } },
);
