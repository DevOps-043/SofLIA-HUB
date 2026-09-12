// Opt-in: descarga sólo bytes fijados del ejemplo oficial, sin cuenta ni perfil del usuario.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { app, BrowserWindow, WebContentsView, session, dialog } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'catalog' || process.versions.electron !== expectedVersion) app.exit(1);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, phase, name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.on('window-all-closed', () => {});
const report = { status: 'running', electron: process.versions.electron, phase, checks: [], limitations: [] };
const check = text => { report.checks.push(text); console.log('[Smoke] OK: ' + text); };
const { BrowserExtensionManager } = require(path.join(sandbox, 'compiled/integrated-browser/extension-manager.js'));
const { listExtensionCatalog, getCatalogFilePins } = require(path.join(sandbox, 'compiled/integrated-browser/extension-catalog.js'));
let window, manager;
void app.whenReady().then(async () => {
  const entry = listExtensionCatalog()[0];
  const source = path.join(sandbox, 'catalog-source'); fs.mkdirSync(source);
  const base = 'https://raw.githubusercontent.com/GoogleChrome/chrome-extensions-samples/' + entry.revision + '/functional-samples/tutorial.reading-time/';
  for (const file of getCatalogFilePins(entry.id)) {
    const response = await fetch(base + file.relative, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    assert.equal(response.ok, true);
    assert.ok(Number(response.headers.get('content-length')) < 1024 * 1024);
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength; assert.ok(bytes <= 1024 * 1024);
        chunks.push(Buffer.from(part.value));
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    const content = Buffer.concat(chunks);
    assert.equal(createHash('sha256').update(content).digest('hex'), file.sha256);
    const destination = path.join(source, file.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content, { flag: 'wx' });
  }
  check('siete archivos oficiales coinciden con revisión y huellas fijadas');
  window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  const browserSession = session.fromPartition('persist:catalog-fixture');
  await browserSession.protocol.handle('https', () => new Response('<!doctype html><devsite-content><article><h1>Prueba</h1><p>Texto de prueba para lectura.</p></article></devsite-content>', { headers: { 'Content-Type': 'text/html' } }));
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  manager = new BrowserExtensionManager(path.join(sandbox, 'catalog-managed'));
  let preview = await manager.prepareFromDialog(window, () => {}, { id: entry.id });
  let installed = await manager.confirmInstall(preview.preview.token, browserSession);
  assert.equal(installed.catalogRevision, entry.revision); assert.equal(installed.status, 'loaded');
  const open = async url => {
    const view = new WebContentsView({ webPreferences: { session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    window.contentView.addChildView(view); await view.webContents.loadURL(url);
    await view.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 250))');
    return view.webContents;
  };
  let contents = await open('https://developer.chrome.com/docs/extensions/fixture');
  assert.equal(await contents.executeJavaScript('document.body.textContent.includes("min read")'), true);
  check('paquete oficial se carga y calcula tiempo de lectura en Chromium real');
  contents.close();
  const outside = await open('https://otro.example/'); assert.equal(await outside.executeJavaScript('document.body.textContent.includes("min read")'), false); outside.close();
  check('el paquete no inyecta en un sitio fuera de su manifiesto');
  await manager.setEnabled(installed.installId, false, browserSession);
  await manager.restrictSites(installed.installId, [], () => {});
  const previous = installed.installId;
  preview = await manager.prepareFromDialog(window, () => {}, { id: entry.id, updateInstallId: previous });
  assert.ok(preview.preview.updateName);
  installed = await manager.confirmInstall(preview.preview.token, browserSession);
  assert.notEqual(installed.installId, previous); assert.deepEqual(installed.siteAccess, []);
  assert.equal(fs.existsSync(path.join(sandbox, 'catalog-managed', previous)), false);
  contents = await open('https://developer.chrome.com/docs/extensions/fixture');
  assert.equal(await contents.executeJavaScript('document.body.textContent.includes("min read")'), false); contents.close();
  check('reinstalación explícita conserva revocación y sustituye sólo la copia anterior');
  fs.appendFileSync(path.join(source, 'scripts/content.js'), '\n// cambio no autorizado');
  await assert.rejects(() => manager.prepareFromDialog(window, () => {}, { id: entry.id }));
  assert.equal((await manager.list())[0].installId, installed.installId);
  check('un byte modificado impide revisar otro paquete sin afectar lo instalado');
  report.status = 'passed';
}).catch(error => { report.status = 'failed'; report.error = String(error); console.error(error); })
  .finally(() => {
    manager?.resetForProfileChange(); if (window && !window.isDestroyed()) window.destroy();
    fs.writeFileSync(path.join(sandbox, phase + '.json'), JSON.stringify(report, null, 2)); app.exit(report.status === 'passed' ? 0 : 1);
  });
