import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import support from '../python-runtime-support.cjs';
import { download } from '../python-runtime-download.mjs';

export async function prepareTestPython({ environment = process.env, platform = process.platform, arch = process.arch,
  fetchArchive = download, run = execFileSync } = {}) {
  // No aceptar overrides de URL/hash: QA usa el mismo artefacto aprobado.
  const spec = support.archiveSpec(platform, arch, {});
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'soflia-test-python-'));
  const archive = path.join(temporary, 'runtime.tar.gz');
  await fetchArchive(spec.url, archive);
  if (support.sha256File(archive) !== spec.sha256) throw new Error('SHA256 Python incompatible; no se extrae ni ejecuta.');
  const directory = path.join(temporary, 'python');
  fs.mkdirSync(directory);
  const systemTar = path.join(environment.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  const tar = platform === 'win32' && fs.existsSync(systemTar) ? systemTar : 'tar';
  const options = { cwd: directory, env: support.runtimeEnvironment(directory, platform, environment), windowsHide: true, timeout: 180000 };
  run(tar, ['-xzf', archive, '--strip-components=1'], { ...options, stdio: 'inherit' });
  const executable = support.pythonExecutable(directory, platform);
  const expectedMachine = { 'win32/x64': ['AMD64', 'x86_64'], 'darwin/x64': ['x86_64'], 'darwin/arm64': ['arm64'], 'linux/x64': ['x86_64'], 'linux/arm64': ['aarch64', 'arm64'] }[`${platform}/${arch}`];
  const probe = run(executable, ['-I', '-S', '-B', '-c', 'import sys,platform,json; print(json.dumps([list(sys.version_info[:3]),platform.machine()]))'],
    { ...options, encoding: 'utf8', maxBuffer: 4096, timeout: 10000 });
  let actual;
  try { actual = JSON.parse(probe); } catch { throw new Error('El intérprete preparado no devolvió metadata válida.'); }
  if (JSON.stringify(actual?.[0]) !== JSON.stringify(support.PYTHON_VERSION.split('.').map(Number)) || !expectedMachine.includes(actual?.[1])) {
    throw new Error('Versión o arquitectura del intérprete preparado incompatible.');
  }
  const receipt = { executable, temporary, pythonVersion: support.PYTHON_VERSION, platform, arch, archiveSha256: spec.sha256, promoted: false };
  fs.writeFileSync(path.join(temporary, 'test-python-receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== '--github-actions')) throw new Error('Uso: prepare-test-python.mjs [--github-actions]');
    const github = args.length === 1;
    if (github && (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV)) throw new Error('No hay contexto GitHub Actions para registrar el intérprete.');
    const receipt = await prepareTestPython();
    if (github) {
      if (/[\r\n]/.test(receipt.executable)) throw new Error('Ruta CI inválida.');
      fs.appendFileSync(process.env.GITHUB_ENV, `SOFLIA_TEST_PYTHON=${receipt.executable}\n`);
    }
    console.log(JSON.stringify(receipt));
  } catch (error) { console.error(`[Python de pruebas] ${error.message}`); process.exitCode = 1; }
}
