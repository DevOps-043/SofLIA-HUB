import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Configuracion plana de ESLint 10. Reemplaza a `.eslintrc.cjs` conservando el
 * mismo conjunto de reglas: recomendadas de JavaScript, recomendadas de
 * TypeScript, `react-hooks` y el aviso de `react-refresh`.
 *
 * El formato antiguo dejo de estar soportado y ademas bloqueaba la
 * actualizacion de TypeScript: `ts-api-utils`, dependencia de la version 7 de
 * typescript-eslint, no funciona con las versiones nuevas del compilador.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'build/**',
      'node_modules/**',
      'python-runtime/**',
      'models/**',
      'coverage/**',
      '.worktrees/**',
    ],
  },
  { files: ['scripts/**/*.mjs', 'eslint.config.mjs'], languageOptions: { globals: globals.node } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { parserOptions: { tsconfigRootDir: dirname(fileURLToPath(import.meta.url)) } },
  },
  {
    // Entradas Node CommonJS: hooks y fixtures nativas se cargan con require.
    files: ['scripts/setup-python-runtime.js', 'scripts/python-runtime-support.cjs', 'scripts/verify-packaged-python.cjs', 'test/manual/voice-ipc/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
