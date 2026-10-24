import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

assert.equal(process.argv.length, 2, 'El smoke no admite perfiles ni argumentos.');
const require = createRequire(path.join(projectRoot, 'package.json'));
const executable = require('electron');
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-project-ipc-native-'));
await fs.mkdir(path.join(sandbox, 'profile', 'session'), { recursive: true });
await fs.mkdir(path.join(sandbox, 'dist'));
await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const version = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')).devDependencies.electron;
const sources = [
  'electron/project-hub-handlers', 'electron/project-hub/index', 'electron/project-hub/types', 'electron/project-hub/service',
  'electron/project-hub/authentication', 'electron/project-hub/transport', 'electron/project-hub/session-contract',
  'electron/project-hub/session-context', 'electron/project-hub/session-store', 'electron/project-hub/ipc-review',
  'electron/project-hub/upload', 'electron/project-hub/upload-files', 'electron/project-hub/upload-target', 'electron/project-hub/upload-handlers',
  'electron/project-hub/file-format', 'electron/project-hub/file-operations', 'electron/project-hub/storage-target',
  'electron/project-hub/download', 'electron/project-hub/download-target', 'electron/project-hub/download-destination', 'electron/project-hub/download-handlers',
  'electron/main/auth-state', 'electron/ipc/caller-authorization', 'electron/storage/os-cipher', 'electron/storage/private-files',
  'electron/utils/logger', 'electron/utils/logger-options', 'electron/utils/correlation', 'src/shared/project-hub', 'src/shared/project-hub-files',
];
for (const name of sources) {
  const source = await fs.readFile(path.join(projectRoot, name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const destination = path.join(sandbox, name + '.js');
  await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, compiled.outputText);
}
await fs.copyFile(path.join(projectRoot, 'test/manual/project-hub-ipc/main.cjs'), path.join(sandbox, 'main.cjs'));
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'"><title>Prueba IPC local</title><body>Contenido ficticio</body></html>';
await fs.writeFile(path.join(sandbox, 'dist/index.html'), html); await fs.writeFile(path.join(sandbox, 'dist/other.html'), html);
// Compilar en un hijo con entorno mínimo; Vite no carga config ni archivos .env.
const builder = `import {build} from 'vite'; await build({configFile:false,envDir:false,publicDir:false,build:{outDir:${JSON.stringify(path.join(sandbox, 'dist'))},emptyOutDir:false,lib:{entry:${JSON.stringify(path.join(projectRoot, 'test/manual/project-hub-ipc/preload.ts'))},formats:['cjs'],fileName:()=> 'preload.cjs'},rolldownOptions:{external:['electron']}}});`;
await fs.writeFile(path.join(sandbox, 'build.mjs'), builder);
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: 'inherit' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('El smoke IPC excedió 45 segundos.')); }, 45_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Falló el proceso IPC: ' + code)); });
  });
}
console.log('[IPC nativo] Perfil temporal: ' + sandbox);
await run(process.execPath, [path.join(sandbox, 'build.mjs')]);
await run(executable, [path.join(sandbox, 'main.cjs'), version]);
const report = JSON.parse(await fs.readFile(path.join(sandbox, 'report.json'), 'utf8'));
assert.equal(report.status, 'passed'); assert.equal(report.electron, version);
console.log(`[IPC nativo] ${report.checks.length} comprobaciones aprobadas; servicio y diálogo simulados.`);
