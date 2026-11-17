import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const runtime = fileURLToPath(new URL('../packages/zoom-runtime/', import.meta.url));

// El lock oculto de npm acredita la instalación; comprobar también cada paquete
// permite reparar node_modules incompleto sin reinstalarlo en cada typecheck.
export function isZoomRuntimePrepared(directory) {
  try {
    const read = file => JSON.parse(readFileSync(path.join(directory, file), 'utf8'));
    const manifest = read('package.json');
    const lock = read('package-lock.json');
    const installed = read('node_modules/.package-lock.json');
    const dependencies = manifest.dependencies;
    const lockedDependencies = lock.packages[''].dependencies;
    if (Object.keys(dependencies).length !== Object.keys(lockedDependencies).length
      || Object.entries(dependencies).some(([name, version]) => lockedDependencies[name] !== version)) return false;
    const entries = Object.entries(lock.packages).filter(([key]) => key !== '');
    if (entries.length !== Object.keys(installed.packages).length) return false;
    return entries.every(([key, expected]) => {
      const actual = installed.packages[key];
      return actual && actual.version === expected.version && actual.integrity === expected.integrity
        && actual.resolved === expected.resolved && read(`${key}/package.json`).version === expected.version;
    }) && ['@zoom/meetingsdk/dist', '@zoom/videosdk/dist/lib'].every(key => existsSync(path.join(directory, 'node_modules', key)));
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (isZoomRuntimePrepared(runtime)) {
    console.log('[Zoom] Dependencias verificadas; se reutiliza la instalación local.');
  } else {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('Ejecuta la preparación mediante npm run zoom:ensure.');
    const result = spawnSync(process.execPath, [npmCli, 'ci', '--prefix', runtime, '--ignore-scripts'], { stdio: 'inherit', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    if (!isZoomRuntimePrepared(runtime)) throw new Error('La instalación de Zoom está incompleta.');
  }
}
