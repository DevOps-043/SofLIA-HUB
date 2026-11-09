import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildEnvironment, projectRoot } from './smoke-app-build.mjs';

const help = 'Se necesita Python 3.12.x. Instálalo o selecciona su ruta absoluta con SOFLIA_TEST_PYTHON; no se omiten las pruebas.';

export function executePythonTests({ args = [], environment = process.env, platform = process.platform, run = spawnSync } = {}) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--formats')) throw new Error('Argumentos inválidos: sólo se admite --formats.');
  const configured = environment.SOFLIA_TEST_PYTHON;
  if (configured !== undefined && (!configured || !path.isAbsolute(configured))) throw new Error('SOFLIA_TEST_PYTHON debe ser una ruta absoluta al intérprete.');
  const executable = configured ?? (platform === 'win32' ? 'python' : 'python3');
  const options = { cwd: projectRoot, env: buildEnvironment(environment), windowsHide: true, shell: false };
  const probe = run(executable, ['-I', '-S', '-B', '-X', 'utf8', '-c', 'import sys,json; print(json.dumps(list(sys.version_info[:3])))'],
    { ...options, encoding: 'utf8', timeout: 10000, maxBuffer: 4096 });
  let version;
  try { version = JSON.parse(probe.stdout); } catch { /* La metadata inválida se rechaza debajo. */ }
  if (probe.error || probe.status !== 0 || !Array.isArray(version) || version.length !== 3
    || version[0] !== 3 || version[1] !== 12 || !Number.isInteger(version[2]) || version[2] < 0) throw new Error(help);
  const formats = args.length === 1;
  const result = run(executable, ['-I', ...(!formats ? ['-S'] : []), '-B', '-X', 'utf8',
    path.join(projectRoot, 'python/tools_sidecar/tests/run_tests.py'), ...args],
  { ...options, stdio: 'inherit', timeout: formats ? 180000 : 120000 });
  if (result.error || !Number.isInteger(result.status) || result.status < 0) throw new Error('Las pruebas Python no terminaron correctamente; revisa el intérprete o el plazo.');
  return result.status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = executePythonTests({ args: process.argv.slice(2) }); }
  catch (error) { console.error(`[Pruebas Python] ${error.message}`); process.exitCode = 1; }
}
