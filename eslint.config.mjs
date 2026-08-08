import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

/**
 * Configuration ESLint (format plat, ESLint 9).
 *
 * `next lint` etant deprecie et retire dans Next 16, le script npm appelle
 * directement la CLI ESLint. `FlatCompat` permet de reutiliser les presets
 * `eslint-config-next`, encore publies au format historique.
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'prisma/dev.db*', 'next-env.d.ts'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // Les variables prefixees d'un underscore sont volontairement inutilisees
      // (destructuration partielle, parametres de signature imposee).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // `any` doit rester une exception justifiee, pas une erreur bloquante.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Les apostrophes francaises sont echappees dans le JSX ; la regle reste
      // active pour eviter les regressions.
      'react/no-unescaped-entities': 'error',
    },
  },

  {
    // Les tests manipulent volontairement des types partiels et des mocks.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
];

export default config;
