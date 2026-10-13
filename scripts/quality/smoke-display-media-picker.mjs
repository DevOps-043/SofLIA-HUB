import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build, createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { _electron } from 'playwright-core';

// Ejecuta solo el selector y un solicitante local. No arranca Hub ni carga .env.
const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), 'pulse-share-smoke-'));
const require = createRequire(import.meta.url);
const bundle = (entry, name) => build({ configFile: false, envFile: false, root, logLevel: 'error', build: {
  outDir: path.join(directory, 'dist-electron'), emptyOutDir: false, minify: false,
  lib: { entry: path.isAbsolute(entry) ? entry : path.join(root, entry), formats: ['cjs'], fileName: () => name },
  rolldownOptions: { external: ['electron', /^node:/] },
} });
const entry = path.join(directory, 'entry.ts');
await writeFile(entry, `export { configureMainDisplayMedia } from ${JSON.stringify(path.join(root, 'electron/main/display-media.ts').replaceAll('\\', '/'))};
export { setDisplayMediaTabProvider } from ${JSON.stringify(path.join(root, 'electron/integrated-browser/display-media-picker.ts').replaceAll('\\', '/'))};
export { setAuthState } from ${JSON.stringify(path.join(root, 'electron/main/auth-state.ts').replaceAll('\\', '/'))};`);
await bundle(entry, 'picker.cjs');
await bundle('electron/preload.ts', 'preload.js');
const server = await createServer({ configFile: false, envFile: false, root, resolve: { dedupe: ['react', 'react-dom'] }, plugins: [react()], logLevel: 'error', server: { host: '127.0.0.1', port: 0, fs: { allow: [root, directory] } } });
await server.listen();
const devUrl = server.resolvedUrls.local[0];
await writeFile(path.join(directory, 'main.cjs'), `
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { configureMainDisplayMedia, setDisplayMediaTabProvider, setAuthState } = require('./dist-electron/picker.cjs');
app.setPath('userData', ${JSON.stringify(path.join(directory, 'profile'))});
app.whenReady().then(async () => {
 setAuthState({authenticated:true,userId:'prueba-local'});
 const parent = new BrowserWindow({show:true,title:'Ventana de prueba Pulse',width:720,height:400,webPreferences:{preload:path.join(__dirname,'dist-electron/preload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 setDisplayMediaTabProvider(parent,()=>[{id:'prueba',name:'Página local de prueba',documentToken:'prueba',contents:parent.webContents}]);
 configureMainDisplayMedia(parent);
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="es"><body><button id="share">Presentar</button><script>document.querySelector("button").onclick=()=>{window.result="pending";navigator.mediaDevices.getDisplayMedia({video:true,audio:false}).then(stream=>{const track=stream.getVideoTracks()[0];window.result={kind:track.kind,width:track.getSettings().width};stream.getTracks().forEach(t=>t.stop())}).catch(e=>{window.result={error:e.name}})};</script></body></html>')});
 server.listen(0,'127.0.0.1',()=>parent.loadURL('http://127.0.0.1:'+server.address().port));
 app.on('before-quit',()=>server.close());
});
`);
let electron;
try {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA']) if (process.env[key]) env[key] = process.env[key];
  env.VITE_DEV_SERVER_URL = devUrl;
  electron = await _electron.launch({ executablePath: require('electron'), args: [path.join(directory, 'main.cjs')], env, timeout: 30_000 });
  const parent = await electron.firstWindow();
  await parent.locator('#share').waitFor();
  const opening = electron.waitForEvent('window');
  await parent.locator('#share').click();
  const picker = await opening;
  const cards = picker.locator('.share-card'); await cards.first().waitFor({ timeout: 30_000 });
  assert.equal(await picker.evaluate(() => Object.keys(window.displayMediaPicker).sort().join(',')), 'cancel,list,select');
  assert.equal(await picker.evaluate(() => typeof window.ipcRenderer), 'undefined');
  assert.equal(await picker.getByRole('button', { name: 'Compartir', exact: true }).isDisabled(), true);
  assert.equal(await picker.locator('.share-thumbnail > img').count() > 0, true);
  await cards.first().click();
  const screenshot = path.join(directory, 'selector-real.png');
  await picker.screenshot({ path: screenshot });
  await picker.getByRole('button', { name: 'Compartir', exact: true }).click();
  await parent.waitForFunction(() => window.result && window.result !== 'pending');
  const result = await parent.evaluate(() => window.result);
  assert.equal(result.kind, 'video'); assert.ok(result.width > 0);
  const windowOpening = electron.waitForEvent('window');
  await parent.locator('#share').click();
  const windowPicker = await windowOpening;
  await windowPicker.getByRole('tab', { name: /Ventanas/ }).click();
  await windowPicker.getByRole('button', { name: /Ventana de prueba Pulse/ }).click();
  await windowPicker.getByRole('button', { name: 'Compartir', exact: true }).click();
  await parent.waitForFunction(() => window.result && window.result !== 'pending');
  assert.equal((await parent.evaluate(() => window.result)).kind, 'video');
  const tabOpening = electron.waitForEvent('window');
  await parent.locator('#share').click();
  const tabPicker = await tabOpening;
  await tabPicker.getByRole('tab', { name: /Pestañas/ }).click();
  await tabPicker.getByRole('button', { name: /Página local de prueba/ }).click();
  await tabPicker.getByRole('button', { name: 'Compartir', exact: true }).click();
  await parent.waitForFunction(() => window.result && window.result !== 'pending');
  assert.equal((await parent.evaluate(() => window.result)).kind, 'video');
  await electron.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; });
  const reopening = electron.waitForEvent('window');
  await parent.locator('#share').click();
  const cancelPicker = await reopening;
  await cancelPicker.locator('.share-card').first().waitFor();
  await electron.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Compartir pantalla').setSize(760, 560); });
  assert.equal(await cancelPicker.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await cancelPicker.screenshot({ path: path.join(directory, 'selector-oscuro.png') });
  await cancelPicker.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await parent.waitForFunction(() => window.result && window.result !== 'pending');
  assert.ok(['NotAllowedError', 'AbortError'].includes((await parent.evaluate(() => window.result)).error));
  const bindingOpening = electron.waitForEvent('window');
  const bindingPending = parent.evaluate(() => window.studioCapture.choose());
  const bindingPicker = await bindingOpening;
  await bindingPicker.getByRole('tab', { name: /Ventanas/ }).click();
  await bindingPicker.getByRole('button', { name: /Ventana de prueba Pulse/ }).click();
  await bindingPicker.getByRole('button', { name: 'Vincular fuente', exact: true }).click();
  const bindingResult = await bindingPending;
  assert.equal(bindingResult.success, true); assert.ok(bindingResult.binding.id);
  assert.notEqual(bindingResult.binding.id.startsWith('window:'), true);
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await parent.evaluate((id) => window.studioCapture.activate({ bindingId: id, preview: true }), bindingResult.binding.id)).success, true);
    await parent.locator('#share').click();
    await parent.waitForFunction(() => window.result && window.result !== 'pending');
    assert.equal((await parent.evaluate(() => window.result)).kind, 'video');
    assert.equal(electron.windows().length, 1);
  }
  await parent.evaluate((id) => window.studioCapture.release({ bindingId: id }), bindingResult.binding.id);
  assert.equal((await parent.evaluate((id) => window.studioCapture.activate({ bindingId: id, preview: true }), bindingResult.binding.id)).success, false);
  // QA del flujo real de edición, con captura nativa y sin ningún backend Learning.
  const sourcePath = (file) => JSON.stringify(path.join(root, file).replaceAll('\\', '/'));
  await writeFile(path.join(directory, 'harness.tsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client';
import { InstructorStudio } from ${sourcePath('src/components/learning-live/instructor/InstructorStudio.tsx')};
import { StudioMediaContext } from ${sourcePath('src/components/learning-live/instructor/StudioMediaContext.tsx')};
import { useStudioMedia } from ${sourcePath('src/components/learning-live/instructor/useStudioMedia.ts')};
import ${sourcePath('src/index.css')};
function Local() { const media=useStudioMedia(); return <StudioMediaContext.Provider value={{...media,zoomConnected:false,zoomPending:false,zoomStage:null,zoomMic:false,zoomCamera:false,zoomSharing:false,connectZoom:()=>{},stopZoomShare:()=>{},muteZoom:()=>{}}}><InstructorStudio onBack={()=>{}} onClose={()=>{}} /></StudioMediaContext.Provider>; }
createRoot(document.getElementById('root')).render(<Local />);
`);
  await writeFile(path.join(directory, 'harness.html'), '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Escenas locales · QA</title></head><body><div id="root"></div><script type="module" src="./harness.tsx"></script></body></html>');
  await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1360, 900));
  await parent.goto(`${devUrl}@fs/${directory.replaceAll('\\', '/')}/harness.html`);
  await parent.getByRole('button', { name: 'Nueva escena' }).click();
  await parent.getByRole('textbox', { name: 'Nombre de la escena' }).fill('Presentación');
  await parent.getByRole('combobox', { name: 'Contenido de la escena' }).click();
  await parent.getByRole('option', { name: 'Pantalla, ventana o pestaña' }).click();
  assert.equal(await parent.getByRole('button', { name: 'Guardar escena' }).isDisabled(), true);
  const sceneOpening = electron.waitForEvent('window');
  await parent.getByRole('button', { name: 'Vincular fuente', exact: true }).click();
  const scenePicker = await sceneOpening;
  await scenePicker.locator('.share-card').first().click();
  await scenePicker.getByRole('button', { name: 'Vincular fuente', exact: true }).click();
  await parent.getByRole('img', { name: /Fuente ligada/ }).waitFor();
  await parent.getByRole('dialog').screenshot({ path: path.join(directory, 'editor-ligado.png') });
  await parent.getByRole('button', { name: 'Guardar escena' }).click();
  await parent.getByRole('button', { name: 'Mostrar escena Presentación' }).waitFor();
  await parent.getByRole('button', { name: 'Compartir pantalla', exact: true }).click();
  await parent.getByRole('button', { name: 'Dejar de compartir pantalla' }).waitFor();
  await parent.getByRole('button', { name: 'Dejar de compartir pantalla' }).click();
  await parent.getByRole('button', { name: 'Compartir pantalla', exact: true }).click();
  await parent.getByRole('button', { name: 'Dejar de compartir pantalla' }).waitFor();
  assert.equal(electron.windows().length, 1);
  await parent.screenshot({ path: path.join(directory, 'escena-ligada.png') });
  await parent.getByRole('button', { name: 'Quitar escena Presentación' }).click();
  await parent.getByText('Prepara tu primera escena').waitFor();
  console.log('Smoke nativo: miniaturas, pantalla/ventana/pestaña, vínculo reutilizado sin selector, liberación, tema oscuro y cancelación correctos.');
  console.log('Editor nativo: escena local con fuente real, compartir, detener/retomar sin selector y quitar correctos.');
  console.log('Vista local: ' + screenshot);
} finally { await electron?.close(); await server.close(); }
