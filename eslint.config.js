import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/drizzle/', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['web/**', 'react/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
);
