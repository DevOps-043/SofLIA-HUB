// =============================================================================
// SofLIA Hub - Setup del runtime Python privado (Windows, macOS y Linux)
// =============================================================================
// Descarga la distribucion "embeddable" oficial de Python (PSF License,
// redistribuible), la extrae en python-runtime/, habilita site-packages,
// instala pip y las dependencias fijadas en python/requirements.txt.
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
const PYTHON_EMBED_URL = process.env.PYTHON_EMBED_URL
  || `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
// Verificacion de integridad: si se define PYTHON_EMBED_SHA256 se exige que
// coincida; si no, se ancla el hash calculado en el lockfile (trust-on-first-use).
const EXPECTED_SHA256 = (process.env.PYTHON_EMBED_SHA256 || '').toLowerCase();
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

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
  const archiveHash = process.platform === 'win32'
    ? await prepareWindowsRuntime(compatibleLock)
    : await prepareUnixRuntime(compatibleLock);

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

async function prepareWindowsRuntime(lock) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const zipPath = path.join(RUNTIME_DIR, 'python-embed.zip');
  console.log(`[PythonRuntime] Descargando: ${PYTHON_EMBED_URL}`);
  await downloadFile(PYTHON_EMBED_URL, zipPath, 0);
  const archiveHash = verifyArchive(zipPath, lock);
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${RUNTIME_DIR}" -Force`], { stdio: 'inherit' });
  fs.rmSync(zipPath, { force: true });

  const pthFile = fs.readdirSync(RUNTIME_DIR).find((file) => /^python\d+\._pth$/.test(file));
  if (!pthFile) throw new Error('No se encontro el archivo ._pth del runtime embebido.');
  const pthPath = path.join(RUNTIME_DIR, pthFile);
  const pth = fs.readFileSync(pthPath, 'utf8').replace('#import site', 'import site');
  fs.writeFileSync(pthPath, `${pth.trimEnd()}\nLib\\site-packages\n`, 'utf8');

  const getPipPath = path.join(RUNTIME_DIR, 'get-pip.py');
  await downloadFile(GET_PIP_URL, getPipPath, 0);
  execFileSync(getRuntimeExecutable(), [getPipPath, '--no-warn-script-location'], { stdio: 'inherit' });
  fs.rmSync(getPipPath, { force: true });
  return archiveHash;
}

async function prepareUnixRuntime(lock) {
  const targets = {
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
  const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_RELEASE}/${fileName}`;
  const archivePath = path.join(ROOT, `.python-runtime-${process.platform}-${process.arch}.tar.gz`);
  const extractDir = path.join(ROOT, `.python-runtime-extract-${process.pid}`);
  console.log(`[PythonRuntime] Descargando distribucion autonoma: ${url}`);
  await downloadFile(url, archivePath, 0);
  const archiveHash = verifyArchive(archivePath, lock);

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { stdio: 'inherit' });
    const extractedPython = path.join(extractDir, 'python');
    if (!fs.existsSync(path.join(extractedPython, 'bin', 'python3'))) {
      throw new Error('El archivo autonomo no contiene python/bin/python3.');
    }
    fs.renameSync(extractedPython, RUNTIME_DIR);
  } finally {
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  return archiveHash;
}

function verifyArchive(archivePath, lock) {
  const archiveHash = sha256File(archivePath);
  console.log(`[PythonRuntime] SHA256: ${archiveHash}`);
  const anchor = EXPECTED_SHA256 || (lock && lock.archiveSha256) || (lock && lock.pythonZipSha256) || '';
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
