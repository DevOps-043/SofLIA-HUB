import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

const rootFiles = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.mts', 'vitest.config.ts', 'postcss.config.js', 'tailwind.config.js', 'index.html']);
const sourceRoots = new Set(['src', 'electron', 'config', 'public', 'resources', 'scripts', 'test']);
export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Sólo fuentes del build; nunca configuraciones locales, perfiles ni outputs. */
export function isBuildSource(relative) {
  const parts = relative.split('/');
  if (parts.some(part => !part || part.startsWith('.') || part.includes('\\') || part.includes(':'))) return false;
  if (parts.some(part => ['node_modules', 'dist', 'dist-electron', 'release', 'python-runtime'].includes(part))) return false;
  return rootFiles.has(relative) || (parts.length > 1 && sourceRoots.has(parts[0]))
    || (parts[0] === 'database' && relative.endsWith('.ts'));
}

/** Fuentes adicionales del instalador, sin cachés Python ni secretos locales. */
export function isInstallerSource(relative) {
  const parts = relative.split('/');
  if (parts.some(part => !part || part.startsWith('.') || part.includes('\\') || part.includes(':'))) return false;
  if (parts.some(part => ['node_modules', '__pycache__', 'python-runtime', 'release', 'dist', 'dist-electron'].includes(part))) return false;
  if (/\.(?:pyc|pyo|pfx|p12|pem|key)$/i.test(relative)) return false;
  return relative === 'electron-builder.json5' || (parts.length > 1 && ['build', 'python'].includes(parts[0]));
}

export function buildEnvironment(source) {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) {
    if (source[key]) env[key] = source[key];
  }
  return env;
}

function regularSource(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.ok(!stat.isSymbolicLink(), 'El build aislado no copia enlaces de fuentes.');
  }
  assert.ok(fs.statSync(current).isFile(), 'La fuente debe ser un archivo regular.');
  return current;
}

export function prepareBuildSandbox({ installer = false } = {}) {
  const root = projectRoot;
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  const files = [...new Set(listed.split('\0').filter(file => isBuildSource(file) || (installer && isInstallerSource(file))))];
  assert.ok(files.includes('vite.config.mts') && files.includes('electron/main.ts'), 'Faltan entradas del build.');
  const dependencies = path.join(root, 'node_modules');
  assert.ok(fs.existsSync(path.join(dependencies, 'vite', 'bin', 'vite.js')), 'Instala las dependencias del worktree antes de verificar.');
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), installer ? 'pulse-installer-build-' : 'pulse-app-build-'));
  console.log(`[Build aislado] Fuentes y artefactos: ${sandbox}`);
  // No limpiar automáticamente: preservar evidencia y no recorrer la junction de dependencias.
  for (const relative of files) {
    let source;
    try { source = regularSource(root, relative); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const destination = path.join(sandbox, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  }
  if (installer) {
    // npm interpreta una junction externa como paquetes file:/extraneous y el
    // recolector de electron-builder omite transitivas. El paquete exige árbol físico.
    console.log('[Build aislado] Copiando dependencias físicas para empaquetar.');
    fs.cpSync(dependencies, path.join(sandbox, 'node_modules'), {
      recursive: true, force: false, errorOnExist: true,
      filter(file) {
        const stat = fs.lstatSync(file);
        assert.ok(!stat.isSymbolicLink(), 'Las dependencias de empaquetado no admiten enlaces.');
        return path.basename(file) !== '.cache';
      },
    });
  } else {
    fs.symlinkSync(dependencies, path.join(sandbox, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  return { sandbox, sourceFiles: files.length };
}

export async function runBuildCommand(sandbox, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: sandbox, env, windowsHide: true, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

export async function compileApp(sandbox, env) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli && path.isAbsolute(npmCli), 'Ejecuta el smoke mediante npm run.');
  const exitCode = await runBuildCommand(sandbox, [npmCli, 'run', 'build:app'], env);
  if (exitCode === 0) {
    for (const file of ['dist/index.html', 'dist-electron/main.js', 'dist-electron/preload.js']) {
      assert.ok(fs.statSync(path.join(sandbox, file)).size > 0, `Falta artefacto de build: ${file}`);
    }
  }
  return exitCode;
}

async function main() {
  assert.equal(process.argv.length, 2, 'El smoke no admite rutas, credenciales ni opciones de publicación.');
  const { sandbox, sourceFiles } = prepareBuildSandbox();
  const exitCode = await compileApp(sandbox, buildEnvironment(process.env));
  const report = { version: 1, at: new Date().toISOString(), exitCode, sourceFiles, envFilesCopied: false, packaged: false, applicationStarted: false };
  fs.writeFileSync(path.join(sandbox, 'build-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  if (exitCode !== 0) { process.exitCode = exitCode; return; }
  console.log('[Build aislado] Compilación aprobada sin .env. No acredita instalador, arranque ni cuentas reales.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
