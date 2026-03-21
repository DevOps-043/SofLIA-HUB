import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['electron/__tests__/**/*.test.ts'],
          setupFiles: ['./test/setup-main.ts'],
          globals: true,
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
        },
      },
    ],
  },
});
