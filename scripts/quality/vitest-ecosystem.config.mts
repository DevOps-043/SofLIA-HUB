import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Contratos del ecosistema usando el runtime de pruebas ya instalado en Hub.
const hub = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = path.resolve(hub, '../..');
const projects = [
  ['learning', 'SofLIA-Learning/SofLIA-Learning/apps/web'],
  ['engine', 'SofLIA - Engine/courseforge/apps/web'],
];
export default defineConfig({
  test: { projects: projects.map(([name, directory]) => {
    const testedDirectory = process.env.PULSEHUB_ECOSYSTEM_RELEASE === '1'
      ? directory.replace('/apps/web', '/.worktrees/browser-ecosystem-session/apps/web') : directory;
    const root = path.join(workspace, testedDirectory);
    return { test: { name, root, environment: 'node', include: ['src/app/api/auth/hub-session/**/*.test.{ts,mjs}', 'src/app/api/auth/hub-session/route.test.{ts,mjs}'] },
      resolve: { alias: { '@': path.join(root, 'src'), vitest: path.join(hub, 'node_modules/vitest/dist/index.js') } } };
  }) },
});
