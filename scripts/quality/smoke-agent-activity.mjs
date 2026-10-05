import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import ts from 'typescript';

// Smoke aislado: requiere build:app, no carga bootstrap, sesiones ni proveedores.
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'soflia-activity-'));
const source = await fs.readFile(path.join(root, 'electron/agent-activity/window.ts'), 'utf8');
await fs.writeFile(path.join(temp, 'window.mjs'), ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText);
await fs.copyFile(path.join(root, 'dist-electron/preload.js'), path.join(temp, 'preload.js'));
await fs.writeFile(path.join(temp, 'smoke.cjs'), `
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(__dirname, 'perfil'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  const { ActivityWindow } = await import('./window.mjs');
  const parent = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await parent.loadFile(${JSON.stringify(path.join(root, 'dist/index.html'))}, { query: { view: 'agent-activity' } });
  const view = new ActivityWindow(() => parent);
  ipcMain.handle('agent-activity:snapshot', () => ({ success: true, data: [{ id: 'muestra', sequence: 1, surface: 'whatsapp', kind: 'presentation', status: 'running', durationMs: 1200, agents: [{ role: 'contenido', status: 'completed' }, { role: 'diseno', status: 'running' }] }] }));
  ipcMain.handle('agent-activity:control', (_event, action) => { view[action](); return { success: true, data: [] }; });
  view.show();
  for (let count = 0; count < 80; count++) {
    await wait(100);
    if ((await view.window.webContents.executeJavaScript('document.body.innerText')).includes('WhatsApp')) break;
  }
  const text = await view.window.webContents.executeJavaScript('document.body.innerText');
  assert.ok(text.includes('WhatsApp') && text.includes('Trabajando'), 'El renderer debe mostrar el equipo');
  const exposed = await view.window.webContents.executeJavaScript('({ activity: typeof window.agentActivity, runtime: typeof window.agentRuntime, ipc: typeof window.ipcRenderer, desktop: typeof window.desktopAgent })');
  assert.equal(exposed.activity, 'object');
  for (const name of ['runtime', 'ipc', 'desktop']) assert.equal(exposed[name], 'undefined');
  const capture = await view.window.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'monitor.png'), capture.toPNG());
  view.hide(); assert.equal(view.window.isVisible(), false);
  view.show(); await wait(150); assert.equal(view.window.isVisible(), true);
  view.minimize(); await wait(150); assert.equal(view.window.isMinimized(), true);
  view.show(); await wait(150); assert.equal(view.window.isMinimized(), false);
  view.window.close(); assert.equal(view.window.isDestroyed(), false); assert.equal(view.window.isVisible(), false);
  view.destroy(); parent.destroy();
  console.log('Smoke nativo aprobado: renderer, preload restringido, ocultar, reabrir, minimizar y cerrar.');
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
`);
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
console.log(`Evidencia local: ${temp}`);
await new Promise((resolve, reject) => {
  const child = spawn(require('electron'), [path.join(temp, 'smoke.cjs')], { cwd: temp, env, windowsHide: true, stdio: 'inherit' });
  const timer = setTimeout(() => { child.kill(); reject(new Error('El smoke agotó su tiempo.')); }, 30_000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Falló el smoke nativo.')); });
});
