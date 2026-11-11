import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

assert.equal(process.argv.length, 2, 'El smoke no admite modelos, capturas o perfiles externos.');
const require = createRequire(path.join(projectRoot, 'package.json'));
const manifest = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-validation-onnx-native-'));
console.log('[Validación nativa] Temporal: ' + sandbox);
await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
await fs.writeFile(path.join(sandbox, 'expected.json'), JSON.stringify({ zod: manifest.dependencies.zod, onnx: manifest.dependencies['onnxruntime-node'], zip: require('adm-zip/package.json').version }));
for (const name of ['onnx-parser', 'letterbox', 'yolo-postprocess', '../sharp']) {
  const relative = path.posix.normalize('electron/desktop-agent/visual-parser/' + name);
  const source = (await fs.readFile(path.join(projectRoot, relative + '.ts'), 'utf8'))
    .split('import.meta.url').join("require('node:url').pathToFileURL(__filename).href");
  const destination = path.join(sandbox, relative + '.js'); await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText);
}
for (const name of ['main.cjs', 'contracts.cjs', 'models.cjs']) await fs.copyFile(path.join(projectRoot, 'test/manual/validation-onnx', name), path.join(sandbox, name));
for (const mode of ['node', 'electron']) {
  await new Promise((resolve, reject) => {
    const child = spawn(mode === 'node' ? process.execPath : require('electron'), [path.join(sandbox, 'main.cjs'), mode], {
      cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: 'inherit',
    });
    const timer = setTimeout(() => { child.kill(); reject(new Error('La verificación nativa excedió 60 segundos.')); }, 60000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('Falló la verificación: ' + mode)); });
  });
  const report = JSON.parse(await fs.readFile(path.join(sandbox, 'qa-' + mode, 'report.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  if (mode === 'electron') assert.equal(report.electron, manifest.devDependencies.electron);
  console.log(`[Validación nativa] ${mode}: ${report.checks.length} comprobaciones aprobadas.`);
}
