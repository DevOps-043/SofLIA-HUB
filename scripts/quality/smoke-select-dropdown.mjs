import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEnvironment, prepareBuildSandbox, projectRoot } from './smoke-app-build.mjs';

const [mode, target] = process.argv.slice(2);
const script = fileURLToPath(import.meta.url);
function assertSandbox(directory) {
  assert.ok(path.isAbsolute(directory) && path.basename(directory).startsWith('pulse-app-build-'));
  const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(directory));
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
}

function run(executable, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('La prueba del selector superó 90 segundos.')); }, 90_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(`La prueba terminó con código ${code}.`)); });
  });
}

if (mode === '--build') {
  assertSandbox(target);
  // Proceso hijo con entorno allowlisted; sin config de la app ni archivos .env.
  const [{ build }, { default: react }] = await Promise.all([import('vite'), import('@vitejs/plugin-react')]);
  await build({
    configFile: false, envDir: false, publicDir: false, base: './',
    root: path.join(target, 'test/manual/select-dropdown'), plugins: [react()],
    css: { postcss: target },
    build: { outDir: path.join(target, 'select-dropdown-dist'), emptyOutDir: false },
  });
} else {
  assert.equal(process.platform, 'win32', 'El smoke nativo del selector está preparado para Windows.');
  assert.equal(mode, '--electron', 'Usa --electron RUTA_ABSOLUTA.');
  assert.ok(target && path.isAbsolute(target) && fs.statSync(target).isFile());
  assert.equal(process.argv.length, 4, 'No se admiten parámetros adicionales.');
  const { sandbox } = prepareBuildSandbox();
  assertSandbox(sandbox);
  const env = buildEnvironment(process.env);
  const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).devDependencies.electron;
  await run(process.execPath, [script, '--build', sandbox], sandbox, env);
  await run(target, [path.join(projectRoot, 'test/manual/select-dropdown/main.cjs'), sandbox, version], sandbox, env);
  const report = JSON.parse(fs.readFileSync(path.join(sandbox, 'select-dropdown.json'), 'utf8'));
  assert.equal(report.status, 'passed');
  assert.equal(report.electron, version);
  console.log(`[Selector] ${report.checks.length} comprobaciones nativas aprobadas. Evidencia: ${sandbox}`);
}
