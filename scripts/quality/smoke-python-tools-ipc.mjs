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
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-tools-ipc-native-'));
await fs.mkdir(path.join(sandbox, 'profile/session'), { recursive: true }); await fs.mkdir(path.join(sandbox, 'dist'));
await fs.symlink(path.join(projectRoot, 'node_modules'), path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
for (const name of ['electron/python-tools-handlers', 'electron/python/privacy-store', 'electron/python/document-snapshot', 'electron/python/tools-contract', 'electron/python/tools-error',
  'src/shared/python-tools', 'electron/main/auth-state', 'electron/ipc/caller-authorization', 'electron/utils/logger', 'electron/utils/logger-options', 'electron/utils/correlation']) {
  const source = await fs.readFile(path.join(projectRoot, name + '.ts'), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const destination = path.join(sandbox, name + '.js'); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, result.outputText);
}
await fs.copyFile(path.join(projectRoot, 'test/manual/python-tools-ipc/main.cjs'), path.join(sandbox, 'main.cjs'));
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'"><title>QA documental</title><body>Datos ficticios</body></html>';
await fs.writeFile(path.join(sandbox, 'dist/index.html'), html); await fs.writeFile(path.join(sandbox, 'dist/other.html'), html);
const builder = `import {build} from 'vite'; await build({configFile:false,envDir:false,publicDir:false,build:{outDir:${JSON.stringify(path.join(sandbox, 'dist'))},emptyOutDir:false,lib:{entry:${JSON.stringify(path.join(projectRoot, 'test/manual/python-tools-ipc/preload.ts'))},formats:['cjs'],fileName:()=> 'preload.cjs'},rolldownOptions:{external:['electron']}}});`;
await fs.writeFile(path.join(sandbox, 'build.mjs'), builder);
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: 'inherit' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('El smoke documental excedió 45 segundos.')); }, 45_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error('Falló el proceso documental: ' + code)); });
  });
}
console.log('[Documentos IPC nativo] Perfil temporal: ' + sandbox);
await run(process.execPath, [path.join(sandbox, 'build.mjs')]); await run(require('electron'), [path.join(sandbox, 'main.cjs')]);
const report = JSON.parse(await fs.readFile(path.join(sandbox, 'report.json'), 'utf8')); assert.equal(report.status, 'passed');
console.log(`[Documentos IPC nativo] ${report.checks.length} comprobaciones aprobadas; lector y diálogos simulados.`);
