import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import boia from './eslint-rules/no-loose-strings.mjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.next-dev/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/dist/**',
      '**/next-env.d.ts',
      'docs/**',
      'tools/**',
      'art/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Plan 032 T303: nada de texto suelto en los componentes (van por clave en
    // apps/web/lib/i18n/). `allow`: cadenas exactas que no se traducen (la marca).
    files: ['apps/web/**/*.tsx'],
    ignores: ['**/*.test.tsx', 'apps/web/e2e/**'],
    plugins: { boia },
    rules: { 'boia/no-loose-strings': ['error', { allow: ['BOIA', 'BOIA.PLANET'] }] },
  },
  prettier,
);
