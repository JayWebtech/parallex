import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      'examples/nextjs-site/out/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/next-env.d.ts',
      'packages/tracker/versions/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      // Used deliberately where a value is known to exist (e.g. insert … returning()).
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettier,
);
