import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

export function isPrerelease(version) {
  return typeof version === 'string' && version.includes('-');
}

export function validateElectronRelease({ version, exception, now = new Date() }) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) return { valid: false, reason: 'Electron debe fijar una versión exacta válida.' };
  if (!isPrerelease(version)) return { valid: true, exceptionUsed: false };
  if (!exception || exception.version !== version || typeof exception.expiresAt !== 'string') {
    return { valid: false, reason: `Electron ${version} es prerelease y no tiene una excepción versionada.` };
  }
  const expiresAt = new Date(exception.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: `La excepción de Electron ${version} está vencida o es inválida.` };
  }
  if (typeof exception.risk !== 'string' || !exception.risk.trim() || typeof exception.rollback !== 'string' || !exception.rollback.trim()) {
    return { valid: false, reason: 'La excepción no documenta riesgo y rollback.' };
  }
  return { valid: true, exceptionUsed: true };
}

function run() {
  const root = process.cwd();
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = packageJson.devDependencies?.electron;
  if (typeof version !== 'string') throw new Error('package.json no fija una versión exacta de Electron.');
  const exceptionPath = path.join(root, 'config', 'electron-prerelease-exception.json');
  const exception = fs.existsSync(exceptionPath) ? JSON.parse(fs.readFileSync(exceptionPath, 'utf8')) : null;
  const result = validateElectronRelease({ version, exception });
  if (!result.valid) {
    console.error(`[Runtime] ${result.reason}`);
    process.exitCode = 1;
    return;
  }
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const require = createRequire(path.join(root, 'package.json'));
  const installed = require('electron/package.json').version;
  if (lock.packages?.['node_modules/electron']?.version !== version || installed !== version) throw new Error('El manifiesto, lockfile y Electron instalado no coinciden.');
  const executable = require('electron');
  const env = { ELECTRON_RUN_AS_NODE: '1' };
  for (const name of ['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) if (process.env[name]) env[name] = process.env[name];
  const runtime = spawnSync(executable, ['-p', 'process.versions.electron'], { encoding: 'utf8', env, windowsHide: true, timeout: 15_000 });
  if (runtime.error || runtime.status !== 0 || runtime.stdout.trim() !== version) throw new Error('El ejecutable instalado no acredita la versión estable declarada.');
  console.log(`[Runtime] Electron ${version} aprobado${result.exceptionUsed ? ' mediante excepción temporal' : ' como versión estable'}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
