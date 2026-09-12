// Extensiones y sitios locales desechables: no carga carpetas ni perfiles del usuario.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, WebContentsView, session, dialog } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'extensions' || process.versions.electron !== expectedVersion) app.exit(1);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, phase, name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const report = { status: 'running', electron: process.versions.electron, phase, checks: [], limitations: [] };
const check = label => { report.checks.push(label); console.log('[Smoke] OK: ' + label); };
let server, window, manager;
app.on('window-all-closed', () => {});
const { BrowserExtensionManager } = require(path.join(sandbox, 'compiled/integrated-browser/extension-manager.js'));
void app.whenReady().then(async () => {
  server = http.createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Sitio de prueba</title>' + (request.url === '/' ? '<iframe src="/frame"></iframe>' : '')); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browserSession = session.fromPartition('persist:extension-fixture');
  browserSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('http://localhost:' + port + '/') && !details.url.startsWith('http://127.0.0.1:' + port + '/') && !details.url.startsWith('chrome-extension:') && details.url !== 'about:blank' }));
  window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const source = path.join(sandbox, 'extension-source'); fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Fixture de aislamiento', version: '1.0.0',
    permissions: ['storage', 'scripting'], host_permissions: ['<all_urls>'],
    content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], all_frames: true }],
  }));
  fs.writeFileSync(path.join(source, 'content.js'), 'document.documentElement.dataset.extensionFixture = "injected";');
  fs.writeFileSync(path.join(source, 'panel.html'), '<!doctype html><title>Prueba</title>');
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
  manager = new BrowserExtensionManager(path.join(sandbox, 'extension-managed'));
  const preview = await manager.prepareFromDialog(window);
  const installed = await manager.confirmInstall(preview.preview.token, browserSession);
  assert.equal(installed.status, 'loaded');
  const registerView = new WebContentsView({ webPreferences: { session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  window.contentView.addChildView(registerView);
  await registerView.webContents.loadURL('chrome-extension://' + installed.extensionId + '/panel.html');
  await registerView.webContents.executeJavaScript('chrome.scripting.registerContentScripts([{ id: "persisted-fixture", matches: ["http://127.0.0.1/*"], js: ["content.js"], persistAcrossSessions: true }])');
  registerView.webContents.close();
  await manager.setEnabled(installed.installId, false, browserSession);
  const restricted = await manager.restrictSites(installed.installId, ['http://localhost'], () => {});
  assert.deepEqual(restricted.hostPermissions, ['http://localhost/*']);
  const enabled = await manager.setEnabled(installed.installId, true, browserSession);
  assert.equal(enabled.status, 'loaded');
  check('gestor real recompila manifiesto y valida su nueva huella al habilitar');
  const open = async url => {
    const view = new WebContentsView({ webPreferences: { session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    window.contentView.addChildView(view); await view.webContents.loadURL(url); return view.webContents;
  };
  const allowed = await open('http://localhost:' + port + '/');
  const denied = await open('http://127.0.0.1:' + port + '/');
  await allowed.executeJavaScript('new Promise(resolve => setTimeout(resolve, 200))');
  assert.equal(await allowed.executeJavaScript('document.documentElement.dataset.extensionFixture'), 'injected');
  assert.equal(await denied.executeJavaScript('document.documentElement.dataset.extensionFixture'), undefined);
  assert.equal(await allowed.executeJavaScript('document.querySelector("iframe").contentDocument.documentElement.dataset.extensionFixture'), undefined);
  check('Chromium inyecta sólo en dominio permitido y marco principal, no en otro host');
  check('un script dinámico persistente previo no se inyecta en el host retirado tras recarga');
  const panel = await open('chrome-extension://' + enabled.extensionId + '/panel.html');
  const run = id => panel.executeJavaScript('chrome.scripting.executeScript({ target: { tabId: ' + id + ' }, func: () => document.title }).then(() => true, () => false)');
  assert.equal(await run(allowed.id), true);
  assert.equal(await run(denied.id), false);
  check('Chromium exige permiso de host también para scripting dinámico');
  for (const contents of [allowed, denied, panel]) contents.close();
  await manager.setEnabled(installed.installId, false, browserSession);
  await manager.restrictSites(installed.installId, [], () => {});
  assert.equal((await manager.setEnabled(installed.installId, true, browserSession)).status, 'loaded');
  const empty = await open('http://localhost:' + port + '/');
  await empty.executeJavaScript('new Promise(resolve => setTimeout(resolve, 200))');
  assert.equal(await empty.executeJavaScript('document.documentElement.dataset.extensionFixture'), undefined);
  check('retirar todos los sitios impide nuevas inyecciones después de recargar');
  empty.close(); report.status = 'passed';
}).catch(error => { report.status = 'failed'; report.error = String(error); console.error(error); })
  .finally(async () => {
    manager?.resetForProfileChange(); if (window && !window.isDestroyed()) window.destroy();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(sandbox, phase + '.json'), JSON.stringify(report, null, 2));
    app.exit(report.status === 'passed' ? 0 : 1);
  });
