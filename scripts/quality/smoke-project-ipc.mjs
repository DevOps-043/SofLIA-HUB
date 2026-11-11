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
const sources = new Set();
const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true };
const moduleHost = { ...ts.sys, getCurrentDirectory: () => projectRoot };

async function compileSource(file) {
  if (sources.has(file)) return;
  sources.add(file);
  const source = await fs.readFile(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions });
  const destination = path.join(sandbox, path.relative(projectRoot, file)).replace(/\.ts$/, '.js');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, compiled.outputText);
  const imports = ts.preProcessFile(compiled.outputText, true, true).importedFiles;
  for (const { fileName } of imports) {
    if (!fileName.startsWith('.')) continue;
    const { resolvedModule } = ts.resolveModuleName(fileName, file, compilerOptions, moduleHost);
    assert.ok(resolvedModule && !resolvedModule.isExternalLibraryImport, `Dependencia del smoke no resuelta: ${fileName}`);
    await compileSource(resolvedModule.resolvedFileName);
  }
}

for (const entry of ['electron/project-hub-handlers.ts', 'electron/main/auth-state.ts']) {
  await compileSource(path.join(projectRoot, entry));
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
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('Falló el proceso IPC: ' + code)); });
  });
}
console.log('[IPC nativo] Perfil temporal: ' + sandbox);
await run(process.execPath, [path.join(sandbox, 'build.mjs')]);
await run(executable, [path.join(sandbox, 'main.cjs'), version]);
const report = JSON.parse(await fs.readFile(path.join(sandbox, 'report.json'), 'utf8'));
assert.equal(report.status, 'passed'); assert.equal(report.electron, version);
console.log(`[IPC nativo] ${report.checks.length} comprobaciones aprobadas; servicio y diálogo simulados.`);
