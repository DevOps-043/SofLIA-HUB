import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

assert.equal(process.argv.length, 2, 'El contrato de imágenes no admite archivos ni destinos externos.');
const require = createRequire(path.join(projectRoot, 'package.json'));
const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-image-contract-native-'));
console.log('[Imágenes] Temporal: ' + directory);
await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const file of ['main.cjs', 'contracts.cjs']) await fs.copyFile(path.join(projectRoot, 'test/manual/image-dependencies', file), path.join(directory, file));
await fs.writeFile(path.join(directory, 'expected.json'), JSON.stringify({ electron: manifest.devDependencies.electron, sharp: manifest.dependencies.sharp, overrides: manifest.overrides }));
for (const mode of ['node', 'electron']) {
  await new Promise((resolve, reject) => {
    const child = spawn(mode === 'node' ? process.execPath : require('electron'), [path.join(directory, 'main.cjs'), mode], {
      cwd: directory, env: { ...buildEnvironment(process.env), ...(mode === 'electron' ? { ELECTRON_RUN_AS_NODE: '1' } : {}) },
      windowsHide: true, stdio: 'inherit',
    });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('El contrato de imágenes superó 30 segundos.')); }, 30_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); if (code === 0) resolve(); else reject(new Error('Falló el contrato de imágenes: ' + mode)); });
  });
  const report = JSON.parse(await fs.readFile(path.join(directory, mode, 'report.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  console.log(`[Imágenes] ${mode}: ${report.checks.length} comprobaciones aprobadas, sin UI ni escritorio.`);
}
