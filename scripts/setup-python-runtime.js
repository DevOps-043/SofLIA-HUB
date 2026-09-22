// Prepara Python privado sin tocar Python del sistema ni borrar el runtime anterior.
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { execFileSync } = require('node:child_process');
const {
  PYTHON_VERSION, RELEASE, archiveSpec, sha256File, pythonExecutable,
  runtimeEnvironment, validateRuntime, isCurrentLock, promoteRuntime,
} = require('./python-runtime-support.cjs');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'python-runtime');

async function download(url, destination, redirects = 0) {
  if (redirects > 5 || new URL(url).protocol !== 'https:') throw new Error('Redirección Python no permitida.');
  const response = await new Promise((resolve, reject) => {
    const request = https.get(url, resolve);
    request.setTimeout(60000, () => request.destroy(new Error('Descarga Python sin respuesta.')));
    request.on('error', reject);
  });
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    response.resume();
    return download(new URL(response.headers.location, url).href, destination, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error(`Descarga Python: HTTP ${response.statusCode}.`);
  }
  let received = 0;
  const quota = new Transform({ transform(chunk, _encoding, done) {
    received += chunk.length;
    done(received > 512 * 1024 * 1024 ? new Error('El archivo Python supera 512 MiB.') : null, chunk);
  } });
  await pipeline(response, quota, fs.createWriteStream(destination, { flags: 'wx' }), { signal: AbortSignal.timeout(15 * 60 * 1000) });
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--force')) throw new Error('Uso: node scripts/setup-python-runtime.js [--force]');
  const spec = archiveSpec(process.platform, process.arch, process.env);
  const requirements = ['python/requirements.txt', 'python/tools_sidecar/requirements.txt'].map(file => path.join(ROOT, file));
  const requirementsSha256 = requirements.map(sha256File).join('');
  const tempRoot = path.join(ROOT, 'tmp');
  fs.mkdirSync(tempRoot, { recursive: true });
  if (fs.lstatSync(tempRoot).isSymbolicLink()) throw new Error('El directorio temporal no puede ser un enlace.');
  const mutex = path.join(tempRoot, 'python-runtime-setup.lock');
  let handle;
  try { handle = fs.openSync(mutex, 'wx'); }
  catch { throw new Error('Ya existe un bloqueo de preparación Python en tmp/python-runtime-setup.lock. Verifica que no haya otro proceso antes de retirarlo.'); }
  try {
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    if (fs.existsSync(RUNTIME) && fs.lstatSync(RUNTIME).isSymbolicLink()) throw new Error('El runtime no puede ser un enlace.');
    let lock;
    try { lock = JSON.parse(fs.readFileSync(path.join(RUNTIME, '.setup-lock.json'), 'utf8')); } catch { /* Sin caché válida. */ }
    if (!process.argv.includes('--force') && isCurrentLock(lock, spec, requirementsSha256, process.platform, process.arch)) {
      validateRuntime(RUNTIME);
      console.log(`[PythonRuntime] Python ${PYTHON_VERSION} y ambos sidecars verificados; sin descargas.`);
      return;
    }

    const staging = fs.mkdtempSync(path.join(tempRoot, 'python-runtime-build-'));
    const archive = path.join(staging, 'runtime.tar.gz');
    const staged = path.join(staging, 'python');
    console.log(`[PythonRuntime] Preparación recuperable: ${staging}`);
    console.log(`[PythonRuntime] Descargando Python ${PYTHON_VERSION} con SHA256 fijado.`);
    await download(spec.url, archive);
    if (sha256File(archive) !== spec.sha256) throw new Error('SHA256 Python no coincide; no se extrae ni ejecuta el archivo.');
    fs.mkdirSync(staged);
    const systemTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    const tar = process.platform === 'win32' && fs.existsSync(systemTar) ? systemTar : 'tar';
    execFileSync(tar, ['-xzf', '../runtime.tar.gz', '--strip-components=1'], { cwd: staged, windowsHide: true, stdio: 'inherit', timeout: 180000 });
    const executable = pythonExecutable(staged);
    const options = { stdio: 'inherit', env: runtimeEnvironment(staged), windowsHide: true, timeout: 1800000 };
    // Sin configuraciones pip del usuario, paquetes user-site ni PYTHONPATH externos.
    execFileSync(executable, ['-I', '-m', 'pip', '--isolated', 'install', '--no-warn-script-location', 'setuptools==80.9.0', 'wheel==0.45.1'], options);
    execFileSync(executable, ['-I', '-m', 'pip', '--isolated', 'install', '--no-warn-script-location', '--no-build-isolation', ...requirements.flatMap(file => ['-r', file])], options);
    if (process.platform === 'linux') {
      const output = execFileSync('ldconfig', ['-p'], { encoding: 'utf8' });
      const match = output.match(/libportaudio\.so\.2[^\n]*=>\s*(\S+)/);
      if (!match || !fs.existsSync(match[1])) throw new Error('Instala libportaudio2 en el runner antes de preparar Python.');
      fs.mkdirSync(path.join(staged, 'lib'), { recursive: true });
      fs.copyFileSync(match[1], path.join(staged, 'lib', 'libportaudio.so.2'));
    }
    validateRuntime(staged);
    // El lock sólo se emite después de pip check e imports completos.
    fs.writeFileSync(path.join(staged, '.setup-lock.json'), JSON.stringify({
      schema: 2, pythonVersion: PYTHON_VERSION, release: RELEASE,
      platform: process.platform, arch: process.arch, archiveUrl: spec.url,
      archiveSha256: spec.sha256, requirementsSha256, createdAt: new Date().toISOString(),
    }, null, 2), { flag: 'wx' });
    const backup = promoteRuntime(staged, RUNTIME, path.join(staging, 'previous-runtime'));
    if (backup) console.log(`[PythonRuntime] Copia anterior conservada: ${backup}`);
    console.log(`[PythonRuntime] Runtime listo y comprobado: ${RUNTIME}`);
  } finally {
    fs.closeSync(handle);
    fs.unlinkSync(mutex);
  }
}

if (require.main === module) main().catch(error => {
  console.error(`[PythonRuntime] ${error.message}`);
  process.exitCode = 1;
});
