/* global AbortController, URL, clearTimeout, console, fetch, process, setTimeout */

import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDirectory, '..');
const projectHubRoot = path.resolve(
  process.env.PROJECT_HUB_DEV_ROOT || path.join(appRoot, '..', '..', 'Project-Hub', 'Project-Hub'),
);
const projectHubUrl = (process.env.PROJECT_HUB_API_URL || 'https://sofliahub.netlify.app').replace(/\/+$/, '');
const children = new Set();
let shuttingDown = false;

function command(commandLine, cwd) {
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], {
        cwd, env: process.env, stdio: 'inherit', windowsHide: true,
      })
    : spawn('sh', ['-lc', commandLine], { cwd, env: process.env, stdio: 'inherit' });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function projectHubResponds() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(`${projectHubUrl}/api/v1/auth/sofia/exchange`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return Boolean(payload && (payload.data !== undefined || payload.error?.code));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isLocalProjectHub() {
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(projectHubUrl).hostname);
  } catch {
    return false;
  }
}

async function ensureProjectHub() {
  if (await projectHubResponds()) {
    console.log(`[DEV] Project Hub disponible en ${projectHubUrl}.`);
    return null;
  }
  if (!isLocalProjectHub()) {
    console.warn(`[DEV] Project Hub remoto no responde en ${projectHubUrl}; SofLIA iniciará en modo degradado.`);
    return null;
  }
  if (!existsSync(path.join(projectHubRoot, 'apps', 'web', 'package.json'))) {
    console.warn(`[DEV] No se encontró Project Hub en ${projectHubRoot}. Define PROJECT_HUB_DEV_ROOT o inicia la API manualmente.`);
    return null;
  }

  console.log(`[DEV] Iniciando Project Hub desde ${projectHubRoot}...`);
  const child = command('npm run dev:web', projectHubRoot);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Project Hub terminó durante el arranque (código ${child.exitCode}).`);
    if (await projectHubResponds()) {
      console.log(`[DEV] Project Hub listo en ${projectHubUrl}.`);
      return child;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Project Hub no respondió en ${projectHubUrl} después de 45 segundos.`);
}

function terminateTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) terminateTree(child);
  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));

try {
  await ensureProjectHub();
  const app = command('npm run dev:app', appRoot);
  app.once('exit', (code) => shutdown(code ?? 0));
} catch (error) {
  console.error(`[DEV] ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
}
