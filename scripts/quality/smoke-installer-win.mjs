import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEnvironment, compileApp, prepareBuildSandbox, projectRoot, runBuildCommand } from './smoke-app-build.mjs';
import { buildInstallerShell } from '../build-installer-shell.mjs';

export const installerArguments = Object.freeze(['--win', 'nsis', '--x64', '--publish', 'never', '--config.win.signExecutable=false']);

export function installerEnvironment(source) {
  return { ...buildEnvironment(source), CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
}

export function installerArtifact(version) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/, 'Versión de instalador inválida.');
  return `release/${version}/Pulse-Hub-Windows-${version}-Setup.exe`;
}

/** El directorio de certificados PE detecta firma embebida, sin ejecutar el EXE. */
export function hasEmbeddedSignature(header) {
  assert.ok(header.length >= 64 && header.toString('ascii', 0, 2) === 'MZ', 'El instalador no es un ejecutable PE.');
  const pe = header.readUInt32LE(60);
  assert.ok(pe >= 64 && pe + 24 <= header.length && header.toString('ascii', pe, pe + 4) === 'PE\0\0', 'Cabecera PE inválida.');
  const optional = pe + 24;
  const length = header.readUInt16LE(pe + 20);
  assert.ok(optional + length <= header.length && length >= 2, 'Cabecera opcional PE incompleta.');
  const magic = header.readUInt16LE(optional);
  assert.ok(magic === 0x10b || magic === 0x20b, 'Formato PE no soportado.');
  const directories = optional + (magic === 0x10b ? 96 : 112);
  assert.ok(directories + 40 <= optional + length, 'Directorio de certificados PE incompleto.');
  assert.ok(header.readUInt32LE(directories - 4) >= 5, 'Falta directorio de certificados PE.');
  return header.readUInt32LE(directories + 32) !== 0 || header.readUInt32LE(directories + 36) !== 0;
}

export async function inspectInstaller(file) {
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0, 'Falta un instalador regular y no vacío.');
  const handle = fs.openSync(file, 'r');
  const header = Buffer.alloc(Math.min(stat.size, 65536));
  try { fs.readSync(handle, header, 0, header.length, 0); }
  finally { fs.closeSync(handle); }
  assert.equal(hasEmbeddedSignature(header), false, 'El artefacto de prueba no debe contener firma Authenticode.');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return { file, bytes: stat.size, sha256: hash.digest('hex'), embeddedSignature: false };
}

function copyPythonRuntime(destination) {
  const source = path.join(projectRoot, 'python-runtime');
  assert.ok(fs.existsSync(path.join(source, 'python.exe')), 'Falta Python privado: ejecuta npm run python:setup antes del smoke. No se descargará Python automáticamente.');
  assert.ok(!fs.lstatSync(source).isSymbolicLink(), 'El runtime privado no puede ser un enlace.');
  assert.ok(!fs.lstatSync(path.join(source, '.setup-lock.json')).isSymbolicLink(), 'El lock Python no puede ser un enlace.');
  const require = createRequire(import.meta.url);
  const { archiveSpec, isCurrentLock, sha256File, validateRuntime } = require('../python-runtime-support.cjs');
  const lock = JSON.parse(fs.readFileSync(path.join(source, '.setup-lock.json'), 'utf8'));
  const requirements = ['python/requirements.txt', 'python/tools_sidecar/requirements.txt'].map(file => sha256File(path.join(projectRoot, file))).join('');
  assert.ok(isCurrentLock(lock, archiveSpec('win32', 'x64'), requirements, 'win32', 'x64'), 'El runtime no coincide con la versión, dependencias y hash oficiales. Ejecuta npm run python:setup.');
  fs.cpSync(source, destination, {
    recursive: true, force: false, errorOnExist: true,
    filter(file) {
      const stat = fs.lstatSync(file);
      assert.ok(!stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory()), 'El runtime no admite enlaces ni archivos especiales.');
      const name = path.basename(file);
      assert.ok(!name.startsWith('.env'), 'El runtime no debe contener configuraciones .env.');
      return name !== '__pycache__' && !/\.(?:pyc|pyo)$/i.test(name);
    },
  });
  validateRuntime(destination, 'win32');
  return { pythonVersion: lock.pythonVersion, archiveSha256: lock.archiveSha256, requirementsSha256: lock.requirementsSha256, validated: true };
}

async function main() {
  assert.equal(process.argv.length, 2, 'El smoke no admite rutas, credenciales ni opciones de publicación.');
  assert.ok(process.platform === 'win32' && process.arch === 'x64', 'Este smoke requiere Windows x64; no ejecuta binarios de otra plataforma.');
  const { sandbox, sourceFiles } = prepareBuildSandbox({ installer: true });
  const report = { version: 1, at: new Date().toISOString(), exitCode: 1, sourceFiles, envFilesCopied: false, packaged: false, applicationStarted: false, installerStarted: false, published: false, signingEnabled: false, stage: 'python' };
  try {
    report.stage = 'dependencias';
    const npmCli = process.env.npm_execpath;
    assert.ok(npmCli && path.isAbsolute(npmCli), 'Ejecuta el smoke mediante npm run.');
    execFileSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--json'], {
      cwd: sandbox, env: installerEnvironment(process.env), windowsHide: true,
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120000,
    });
    report.stage = 'python';
    report.python = copyPythonRuntime(path.join(sandbox, 'python-runtime'));
    const env = installerEnvironment(process.env);
    report.stage = 'compilación';
    assert.equal(await compileApp(sandbox, env), 0, 'Falló la compilación aislada de la aplicación.');
    report.stage = 'identidad visual';
    assert.equal(await runBuildCommand(sandbox, ['scripts/generate-bitmaps.js'], env), 0, 'Falló la generación de identidad del instalador.');
    report.stage = 'empaquetado';
    const builder = path.join(sandbox, 'node_modules', 'electron-builder', 'cli.js');
    assert.equal(await runBuildCommand(sandbox, [builder, ...installerArguments], env), 0, 'Falló el empaquetado Windows sin publicación.');
    report.stage = 'verificación de artefacto';
    const { version } = JSON.parse(fs.readFileSync(path.join(sandbox, 'package.json'), 'utf8'));
    const require = createRequire(import.meta.url);
    const asar = require('@electron/asar');
    const packed = new Set(asar.listPackage(path.join(sandbox, `release/${version}/win-unpacked/resources/app.asar`)).map(file => file.replaceAll('\\', '/')));
    const { dependencies } = JSON.parse(fs.readFileSync(path.join(sandbox, 'package.json'), 'utf8'));
    for (const name of [...Object.keys(dependencies), 'graceful-fs', 'lodash.defaults']) {
      assert.ok(packed.has(`/node_modules/${name}/package.json`), `Dependencia ausente del ASAR: ${name}`);
    }
    report.dependenciesChecked = Object.keys(dependencies).length + 2;
    report.artifact = await inspectInstaller(path.join(sandbox, installerArtifact(version)));
    report.stage = 'interfaz propia';
    const shell = await buildInstallerShell({ root: sandbox });
    report.shell = { ...await inspectInstaller(shell.file), report: shell.report };
    report.packaged = true;
    report.exitCode = 0;
    report.stage = 'completo';
    console.log(`[Instalador aislado] EXE sin firma verificado: ${report.artifact.file}`);
    console.log('[Instalador aislado] No se instaló, abrió ni publicó la aplicación. La prueba no acredita la interfaz ni cuentas reales.');
  } catch (error) {
    console.error(`[Instalador aislado] ${error.message}`);
    process.exitCode = 1;
  } finally {
    // Se conserva todo el temporal para inspección; nunca se recorre ni borra node_modules.
    fs.writeFileSync(path.join(sandbox, 'installer-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
