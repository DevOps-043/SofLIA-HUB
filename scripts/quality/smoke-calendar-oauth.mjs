import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

assert.equal(process.argv.length, 2, 'El smoke OAuth no admite cuentas, URLs o perfiles.');
const require = createRequire(path.join(projectRoot, 'package.json'));
const version = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')).devDependencies.electron;
const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-calendar-oauth-native-'));
for (const module of ['calendar/constants', 'calendar/oauth-proof', 'calendar/oauth-receiver', 'calendar/oauth-window', 'main/auth-state']) {
  const source = await fs.readFile(path.join(projectRoot, 'electron', module + '.ts'), 'utf8');
  const destination = path.join(sandbox, 'electron', module + '.js');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText);
}
await fs.copyFile(path.join(projectRoot, 'test/manual/calendar-oauth/main.cjs'), path.join(sandbox, 'main.cjs'));
console.log('[OAuth nativo] Perfil temporal: ' + sandbox);
await new Promise((resolve, reject) => {
  const child = spawn(require('electron'), [path.join(sandbox, 'main.cjs'), version], {
    cwd: sandbox, env: buildEnvironment(process.env), windowsHide: true, stdio: 'inherit',
  });
  const timer = setTimeout(() => { child.kill(); reject(new Error('El smoke OAuth excedió 45 segundos.')); }, 45000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => {
    clearTimeout(timer);
    if (code === 0) resolve(); else reject(new Error('Falló el smoke OAuth: ' + code));
  });
});
const report = JSON.parse(await fs.readFile(path.join(sandbox, 'report.json'), 'utf8'));
assert.equal(report.status, 'passed'); assert.equal(report.electron, version);
console.log(`[OAuth nativo] ${report.checks.length} comprobaciones aprobadas; navegador externo sustituido, sin cuentas reales.`);
