import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { availableParallelism } from 'node:os';

export default defineConfig({
  test: {
    // Acotar memoria y carga de módulos en hosts con muchos núcleos.
    maxWorkers: Math.min(4, availableParallelism()),
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    projects: [
      {
        test: {
          name: 'main',
          // El documento nativo consume estos CSS como texto; no sustituirlos
          // por los módulos vacíos que Vitest usa para estilos de componentes.
          css: { include: /(?:home|theme-light|theme-dark)\.css(?:\?raw)?$/ },
          environment: 'node',
          include: ['electron/__tests__/**/*.test.ts'],
          setupFiles: ['./test/setup-main.ts'],
          globals: true,
          testTimeout: 15000,
          hookTimeout: 15000,
        },
        resolve: {
          alias: {
            electron: path.resolve(__dirname, 'test/mocks/electron.ts'),
          },
        },
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
          setupFiles: ['./test/setup-renderer.ts'],
          globals: true,
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
    ],
  },
});
