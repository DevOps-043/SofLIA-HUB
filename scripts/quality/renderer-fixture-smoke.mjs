import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
import { buildEnvironment, prepareBuildSandbox, projectRoot } from './smoke-app-build.mjs';

function assertSandbox(directory) {
  assert.ok(path.isAbsolute(directory) && path.basename(directory).startsWith('pulse-app-build-'));
  const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(directory));
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
}

function run(executable, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: 'inherit' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('La prueba renderer superó 90 segundos.')); }, 90_000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); if (code === 0) resolve(); else reject(new Error(`La prueba terminó con código ${code}.`)); });
  });
}

/** Sólo fixtures locales conocidos, nunca rutas o scripts recibidos del producto. */
export async function runRendererFixture(fixture, label, script) {
  assert.ok(['select-dropdown', 'confirmation-dialog'].includes(fixture));
  const [mode, target] = process.argv.slice(2);
  assert.equal(process.argv.length, 4, 'No se admiten parámetros adicionales.');
  if (mode === '--build') {
    assertSandbox(target);
    // Proceso hijo con entorno allowlisted; sin config de la app ni archivos .env.
    const [{ build }, { default: react }] = await Promise.all([import('vite'), import('@vitejs/plugin-react')]);
    await build({
      configFile: false, envDir: false, publicDir: false, base: './',
      root: path.join(target, 'test/manual', fixture), plugins: [react()],
      css: { postcss: target },
      build: { outDir: path.join(target, `${fixture}-dist`), emptyOutDir: false },
    });
  } else {
    assert.equal(process.platform, 'win32', 'El smoke nativo renderer está preparado para Windows.');
    assert.equal(mode, '--electron', 'Usa --electron RUTA_ABSOLUTA.');
    assert.ok(target && path.isAbsolute(target) && fs.statSync(target).isFile());
    const { sandbox } = prepareBuildSandbox();
    assertSandbox(sandbox);
    console.log(`[${label}] Directorio aislado: ${sandbox}`);
    const env = buildEnvironment(process.env);
    const version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).devDependencies.electron;
    await run(process.execPath, [script, '--build', sandbox], sandbox, env);
    await run(target, [path.join(projectRoot, 'test/manual', fixture, 'main.cjs'), sandbox, version], sandbox, env);
    const report = JSON.parse(fs.readFileSync(path.join(sandbox, `${fixture}.json`), 'utf8'));
    assert.equal(report.status, 'passed');
    assert.equal(report.electron, version);
    console.log(`[${label}] ${report.checks.length} comprobaciones nativas aprobadas. Evidencia: ${sandbox}`);
  }
}
