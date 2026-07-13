// =============================================================================
// SofLIA Hub - Setup del runtime Python privado (Windows, macOS y Linux)
// =============================================================================
// Descarga una distribucion autonoma de CPython (python-build-standalone, del
// proyecto Astral; PSF License, redistribuible), la extrae en python-runtime/
// e instala las dependencias fijadas de ambos sidecars.
//
// Se usa python-build-standalone en las TRES plataformas: python.org dejo de
// publicar binarios (incluido el "embeddable") para 3.12.x al entrar la rama
// en fase security-only (las 3.12.11+ son solo codigo fuente), por lo que el
// zip embeddable de Windows ya no existe para versiones con los ultimos CVEs.
// Ademas estos builds incluyen pip, asi que no se necesita get-pip.py.
//
// El resultado (python-runtime/) se empaqueta en el instalador via
// extraResources de electron-builder (ver electron-builder.json5).
//
// Idempotente: guarda un lockfile con hashes; si nada cambio, no hace nada.
// Uso: node scripts/setup-python-runtime.js [--force]
// =============================================================================
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PYTHON_VERSION = '3.12.11';
const STANDALONE_RELEASE = '20250612';
// Verificacion de integridad: si se define PYTHON_RUNTIME_SHA256 se exige que
// coincida; si no, se ancla el hash calculado en el lockfile (trust-on-first-use).
const EXPECTED_SHA256 = (process.env.PYTHON_RUNTIME_SHA256 || '').toLowerCase();

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_DIR = path.join(ROOT, 'python-runtime');
// Dos sidecars, dos listas de dependencias: voz (vosk/sounddevice) y
// herramientas (documentos: pdfplumber/openpyxl/python-pptx/python-docx).
const REQUIREMENTS = path.join(ROOT, 'python', 'requirements.txt');
const TOOLS_REQUIREMENTS = path.join(ROOT, 'python', 'tools_sidecar', 'requirements.txt');
const LOCK_FILE = path.join(RUNTIME_DIR, '.setup-lock.json');

async function main() {
  const force = process.argv.includes('--force');
  // El hash cubre AMBAS listas: si cambian las deps de cualquier sidecar, el
  // setup deja de considerarse valido y se reinstala.
  const requirementsHash = sha256File(REQUIREMENTS) + sha256File(TOOLS_REQUIREMENTS);
  const lock = readLock();
  const compatibleLock = lock
    && lock.pythonVersion === PYTHON_VERSION
    && (!lock.platform || lock.platform === process.platform)
    && (!lock.arch || lock.arch === process.arch)
    ? lock
    : null;
  const pythonExe = getRuntimeExecutable();

  if (!force && lock
    && lock.pythonVersion === PYTHON_VERSION
    && lock.platform === process.platform
    && lock.arch === process.arch
    && lock.requirementsSha256 === requirementsHash
    && fs.existsSync(pythonExe)) {
    console.log(`[PythonRuntime] Runtime ${PYTHON_VERSION} ya instalado y actualizado. Nada que hacer.`);
    return;
  }

  console.log(`[PythonRuntime] Preparando Python embebido ${PYTHON_VERSION} en: ${RUNTIME_DIR}`);
  if (fs.existsSync(RUNTIME_DIR)) fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  const { archiveHash, archiveUrl } = await prepareStandaloneRuntime(compatibleLock);

  console.log('[PythonRuntime] Instalando dependencias de los sidecars (voz + herramientas)...');
  execFileSync(pythonExe, ['-m', 'pip', 'install', '--no-warn-script-location',
    'setuptools', 'wheel'], { stdio: 'inherit' });
  execFileSync(pythonExe, ['-m', 'pip', 'install', '--no-warn-script-location',
    '--no-build-isolation', '-r', REQUIREMENTS], { stdio: 'inherit' });
  execFileSync(pythonExe, ['-m', 'pip', 'install', '--no-warn-script-location',
    '-r', TOOLS_REQUIREMENTS], { stdio: 'inherit' });
  if (process.platform === 'linux') bundleLinuxPortAudio();

  // 6. Guardar lockfile para que el setup sea idempotente
  fs.writeFileSync(LOCK_FILE, JSON.stringify({
    pythonVersion: PYTHON_VERSION,
    platform: process.platform,
    arch: process.arch,
    archiveUrl,
    archiveSha256: archiveHash,
    requirementsSha256: requirementsHash,
    createdAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  // Verificacion final: el runtime importa las dependencias criticas de ambos sidecars
  execFileSync(pythonExe, ['-c',
    'import vosk, sounddevice, pdfplumber, openpyxl, pptx, docx; '
    + 'print("[PythonRuntime] OK: voz (vosk, sounddevice) + herramientas (pdfplumber, openpyxl, pptx, docx)")'], {
    stdio: 'inherit',
    env: runtimeLibraryEnv(),
  });
  console.log('[PythonRuntime] Runtime listo.');
}

function getRuntimeExecutable() {
  return process.platform === 'win32'
    ? path.join(RUNTIME_DIR, 'python.exe')
    : path.join(RUNTIME_DIR, 'bin', 'python3');
}

async function prepareStandaloneRuntime(lock) {
  const targets = {
    win32: {
      x64: 'x86_64-pc-windows-msvc',
    },
    darwin: {
      x64: 'x86_64-apple-darwin',
      arm64: 'aarch64-apple-darwin',
    },
    linux: {
      x64: 'x86_64-unknown-linux-gnu',
      arm64: 'aarch64-unknown-linux-gnu',
    },
  };
  const target = targets[process.platform] && targets[process.platform][process.arch];
  if (!target) throw new Error(`Plataforma Python no soportada: ${process.platform}/${process.arch}`);

  const fileName = `cpython-${PYTHON_VERSION}+${STANDALONE_RELEASE}-${target}-install_only_stripped.tar.gz`;
  const url = process.env.PYTHON_RUNTIME_URL
    || `https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_RELEASE}/${fileName}`;
  const archivePath = path.join(ROOT, `.python-runtime-${process.platform}-${process.arch}.tar.gz`);
  const extractDir = path.join(ROOT, `.python-runtime-extract-${process.pid}`);
  console.log(`[PythonRuntime] Descargando distribucion autonoma: ${url}`);
  await downloadFile(url, archivePath, 0);
  const archiveHash = verifyArchive(archivePath, url, lock);

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    // `tar` existe nativo en Windows 10+ (bsdtar), macOS y Linux.
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { stdio: 'inherit' });
    const extractedPython = path.join(extractDir, 'python');
    const exeRelative = process.platform === 'win32' ? ['python.exe'] : ['bin', 'python3'];
    if (!fs.existsSync(path.join(extractedPython, ...exeRelative))) {
      throw new Error(`El archivo autonomo no contiene python/${exeRelative.join('/')}.`);
    }
    fs.renameSync(extractedPython, RUNTIME_DIR);
  } finally {
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  return { archiveHash, archiveUrl: url };
}

function verifyArchive(archivePath, url, lock) {
  const archiveHash = sha256File(archivePath);
  console.log(`[PythonRuntime] SHA256: ${archiveHash}`);
  // El hash del lockfile solo sirve de ancla si proviene de la MISMA URL:
  // al cambiar de fuente/version el hash anterior dejaria de aplicar.
  const lockAnchor = lock && lock.archiveUrl === url ? lock.archiveSha256 : '';
  const anchor = EXPECTED_SHA256 || lockAnchor || '';
  if (anchor && anchor !== archiveHash) {
    throw new Error(`SHA256 no coincide. Esperado ${anchor}, obtenido ${archiveHash}.`);
  }
  return archiveHash;
}

function bundleLinuxPortAudio() {
  const output = execFileSync('ldconfig', ['-p'], { encoding: 'utf8' });
  const match = output.match(/libportaudio\.so\.2[^\n]*=>\s*(\S+)/);
  if (!match || !fs.existsSync(match[1])) {
    throw new Error('No se encontro libportaudio.so.2. Instala libportaudio2 en el runner de build.');
  }
  const libDir = path.join(RUNTIME_DIR, 'lib');
  fs.mkdirSync(libDir, { recursive: true });
  fs.copyFileSync(match[1], path.join(libDir, 'libportaudio.so.2'));
  console.log(`[PythonRuntime] PortAudio incluido desde: ${match[1]}`);
}

function runtimeLibraryEnv() {
  if (process.platform !== 'linux') return process.env;
  const libDir = path.join(RUNTIME_DIR, 'lib');
  return {
    ...process.env,
    LD_LIBRARY_PATH: [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter),
  };
}

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')); } catch { return null; }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function downloadFile(url, dest, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error(`Demasiadas redirecciones para ${url}`));
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.rmSync(dest, { force: true });
        return resolve(downloadFile(res.headers.location, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.rmSync(dest, { force: true });
        return reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.rmSync(dest, { force: true });
      reject(err);
    });
  });
}

main().catch((err) => {
  console.error(`[PythonRuntime] Error: ${err.message}`);
  process.exit(1);
});
