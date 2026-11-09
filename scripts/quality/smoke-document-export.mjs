import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

assert.equal(process.argv.length, 2, 'El smoke no admite archivos, perfiles o destinos externos.');
const require = createRequire(path.join(projectRoot, 'package.json'));
const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-document-export-native-'));
console.log('[Exportación nativa] Temporal: ' + sandbox);
await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const versions = { exceljs: manifest.dependencies.exceljs, pptxgenjs: manifest.dependencies.pptxgenjs,
  uuid: manifest.overrides[`exceljs@${manifest.dependencies.exceljs}`]?.uuid,
  'image-size': manifest.overrides[`pptxgenjs@${manifest.dependencies.pptxgenjs}`]?.['image-size'] };
assert.ok(Object.values(versions).every(version => typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version)), 'Revisar pins y overrides documentales antes del smoke.');
await fs.writeFile(path.join(sandbox, 'expected.json'), JSON.stringify({ versions, electron: manifest.devDependencies.electron }));
for (const name of ['contracts.cjs', 'main.cjs']) await fs.copyFile(path.join(projectRoot, 'test/manual/document-export', name), path.join(sandbox, name));
const config = `import { defineConfig } from 'vite';
export default defineConfig({ root: ${JSON.stringify(sandbox)}, envDir: ${JSON.stringify(sandbox)}, cacheDir: ${JSON.stringify(path.join(sandbox, 'vite-cache'))}, logLevel: 'warn',
build: { outDir: ${JSON.stringify(path.join(sandbox, 'compiled'))}, emptyOutDir: false,
lib: { entry: ${JSON.stringify(path.join(projectRoot, 'electron/presentation-export/pptx.ts'))}, formats: ['cjs'], fileName: () => 'hub-pptx.cjs' },
rolldownOptions: { external: ['pptxgenjs', 'sharp', /^node:/], output: { exports: 'named' } } } });`;
await fs.writeFile(path.join(sandbox, 'vite.config.mjs'), config);
async function run(executable, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: 'inherit' });
    let expired = false;
    const timer = setTimeout(() => { expired = true; if (!child.kill()) reject(new Error('No se pudo retirar el proceso de QA.')); }, 45000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (expired) reject(new Error('La exportación excedió 45 segundos.'));
      else if (code === 0) resolve(); else reject(new Error('Falló la exportación nativa.'));
    });
  });
}
await run(process.execPath, [path.join(projectRoot, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(sandbox, 'vite.config.mjs')]);
for (const mode of ['node', 'electron']) {
  await run(mode === 'node' ? process.execPath : require('electron'), [path.join(sandbox, 'main.cjs'), mode]);
  const report = JSON.parse(await fs.readFile(path.join(sandbox, 'qa-' + mode, 'report.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  console.log(`[Exportación nativa] ${mode}: ${report.checks.length} comprobaciones aprobadas.`);
}
