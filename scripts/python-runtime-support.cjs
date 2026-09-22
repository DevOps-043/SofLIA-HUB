const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

// Digest de los assets oficiales de Astral, release 20250612 (API de GitHub).
const PYTHON_VERSION = '3.12.11';
const RELEASE = '20250612';
const TARGETS = {
  'win32/x64': ['x86_64-pc-windows-msvc', '51bc462f3d6caf4aef3d77209d01cd5f6c8fe8213c1ae739e573e1c2c473cb2b'],
  'darwin/x64': ['x86_64-apple-darwin', '16797cdee1b879ce0f32d9162f2a3af8b91d8ccb663c75ed3afc2384845c24d7'],
  'darwin/arm64': ['aarch64-apple-darwin', '74dd3b2bbbcb5c87a5044e1f3513fe3b07e72fcfdeb039d0ae83b754911ac31e'],
  'linux/x64': ['x86_64-unknown-linux-gnu', '15a3c9964e485f04d3c92739aca190616e09b2c4fac29b263432f6f29f00c6cf'],
  'linux/arm64': ['aarch64-unknown-linux-gnu', 'df383a0992be93314880232c2ecbe9764ee65caee5f72a13ef672684fc7b8063'],
};

function archiveSpec(platform, arch, env = {}) {
  const target = TARGETS[`${platform}/${arch}`];
  if (!target) throw new Error(`Plataforma Python no soportada: ${platform}/${arch}`);
  const url = env.PYTHON_RUNTIME_URL || `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE}/cpython-${PYTHON_VERSION}+${RELEASE}-${target[0]}-install_only_stripped.tar.gz`;
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('La fuente Python debe ser HTTPS sin credenciales.');
  if (env.PYTHON_RUNTIME_URL && !env.PYTHON_RUNTIME_SHA256) throw new Error('Una fuente Python alternativa requiere SHA256 explícito.');
  const sha256 = env.PYTHON_RUNTIME_SHA256 || target[1];
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('SHA256 Python inválido.');
  return { url, sha256: sha256.toLowerCase() };
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function pythonExecutable(directory, platform = process.platform) {
  return path.join(directory, ...(platform === 'win32' ? ['python.exe'] : ['bin', 'python3']));
}

function runtimeEnvironment(directory, platform = process.platform, source = process.env) {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (source[key]) env[key] = source[key];
  }
  if (platform === 'linux') env.LD_LIBRARY_PATH = path.join(directory, 'lib');
  return env;
}

function validateRuntime(directory, platform = process.platform) {
  const options = { encoding: 'utf8', env: runtimeEnvironment(directory, platform), windowsHide: true, timeout: 120000 };
  const executable = pythonExecutable(directory, platform);
  execFileSync(executable, ['-I', '-m', 'pip', '--isolated', 'check'], options);
  const result = execFileSync(executable, ['-I', '-c',
    'import sys, vosk, sounddevice, faster_whisper, sherpa_onnx, pdfplumber, openpyxl, pptx, docx; '
    + `assert sys.version_info[:3] == (${PYTHON_VERSION.split('.').join(', ')}); print("python-bundle-ok")`], options).trim();
  if (result !== 'python-bundle-ok') throw new Error('El runtime Python no superó la comprobación de voz y documentos.');
}

function isCurrentLock(lock, spec, requirementsSha256, platform, arch) {
  return !!lock && lock.schema === 2 && lock.pythonVersion === PYTHON_VERSION
    && lock.release === RELEASE && lock.platform === platform && lock.arch === arch
    && lock.archiveUrl === spec.url && lock.archiveSha256 === spec.sha256
    && lock.requirementsSha256 === requirementsSha256;
}

// Sólo se promociona un árbol ya validado; la copia anterior nunca se borra.
function promoteRuntime(staged, destination, backup, io = fs) {
  let moved = false;
  if (io.existsSync(destination)) {
    if (io.lstatSync(destination).isSymbolicLink()) throw new Error('El runtime de destino no puede ser un enlace.');
    if (io.existsSync(backup)) throw new Error('El respaldo del runtime ya existe.');
    io.renameSync(destination, backup);
    moved = true;
  }
  try { io.renameSync(staged, destination); }
  catch (error) {
    if (moved) io.renameSync(backup, destination);
    throw error;
  }
  return moved ? backup : null;
}

module.exports = { PYTHON_VERSION, RELEASE, archiveSpec, sha256File, pythonExecutable, runtimeEnvironment, validateRuntime, isCurrentLock, promoteRuntime };
