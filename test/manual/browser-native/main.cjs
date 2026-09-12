const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, WebContentsView, session, dialog } = require('electron');

const [sandbox, expectedVersion, phase] = process.argv.slice(2);
try {
  assert.ok(typeof sandbox === 'string' && path.isAbsolute(sandbox) && path.basename(sandbox).startsWith('pulse-browser-smoke-'));
  assert.ok(['exercise', 'restore'].includes(phase));
  assert.equal(process.versions.electron, expectedVersion);
} catch {
  // Fallar sin el diálogo de excepción de Electron ni abrir un perfil real.
  console.error('[Smoke] Parámetros inválidos o runtime distinto de la versión estable solicitada.');
  app.exit(1);
}
for (const name of ['userData', 'sessionData', 'downloads', 'logs', 'crashDumps']) {
  const directory = path.join(sandbox, name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('no-proxy-server');
const load = (name) => require(path.join(sandbox, 'compiled', `${name}.js`));
const { BrowserSessionStore } = load('integrated-browser/session-store');
const { BrowserHistoryStore } = load('integrated-browser/browser-history-store');
const { BrowserBookmarkStore } = load('integrated-browser/bookmark-store');
const { BrowserDownloadManager } = load('integrated-browser/download-manager');
const { nextBrowserZoomFactor, validateFindQuery } = load('integrated-browser/page-tools');
const { applyBrowserTabZoom } = load('integrated-browser/tab-zoom');
const { ShutdownGuard } = load('main/shutdown-guard');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  node: process.versions.node, phase, checks: [], limitations: [] };
const reportPath = path.join(sandbox, `${phase}.json`);
const sessionPath = path.join(sandbox, 'sesion.json');
const historyPath = path.join(sandbox, 'historial.sqlite');
const store = new BrowserSessionStore(sessionPath);
const history = new BrowserHistoryStore(historyPath, null);
const bookmarks = new BrowserBookmarkStore(path.join(sandbox, 'marcadores.json'));
const views = [];
let server;
let window;
let detached;

function check(label) { report.checks.push(label); console.log(`[Smoke] OK: ${label}`); }
function finishReport() { fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); }
function fail(error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : 'Fallo de smoke';
  finishReport();
  console.error('[Smoke] Falló:', report.error);
  for (const view of views) if (!view.webContents.isDestroyed()) view.webContents.close();
  server?.closeAllConnections();
  server?.close();
  app.exit(1);
}
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
setTimeout(() => fail(new Error('La prueba nativa excedió 60 segundos.')), 60_000).unref();

async function until(predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('No llegó el evento nativo esperado.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function exercise() {
  const payload = Buffer.from('Descarga local de prueba Pulse Hub.\n');
  server = http.createServer((request, response) => {
    if (request.url === '/archivo') {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="prueba.txt"', 'Content-Length': payload.length });
      response.end(payload);
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
      response.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba nativa Pulse</title><body><h1>Navegación de prueba</h1><p>aguacate aguacate</p></body></html>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browserSession = session.fromPartition('persist:pulse-smoke');
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    callback({ cancel: !details.url.startsWith(`${origin}/`) });
  });
  window = new BrowserWindow({ show: false, width: 1000, height: 700,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  for (let index = 0; index < 2; index++) {
    const view = new WebContentsView({ webPreferences: { session: browserSession,
      sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    views.push(view);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    // Electron 44+ ofrece aislamiento nativo por WebContents. El smoke usa
    // Electron estable 43 como barrera de compatibilidad y conserva una
    // limitación explícita cuando esa API aún no existe.
    if (typeof view.webContents.setZoomMode === 'function') view.webContents.setZoomMode('isolated');
    window.contentView.addChildView(view);
    view.setBounds({ x: index * 480, y: 0, width: 480, height: 640 });
    await view.webContents.loadURL(`${origin}/pagina-${index}`);
    assert.equal(view.webContents.getTitle(), 'Prueba nativa Pulse');
  }
  check('Navegación local con dos WebContentsView sandboxed en vista dividida');
  const contents = views[0].webContents;
  let found;
  contents.on('found-in-page', (_event, result) => { if (result.finalUpdate) found = result; });
  contents.findInPage(validateFindQuery('aguacate'));
  await until(() => found);
  assert.equal(found.matches, 2);
  contents.stopFindInPage('clearSelection');
  check('Búsqueda nativa devuelve dos coincidencias');
  applyBrowserTabZoom(contents, nextBrowserZoomFactor(1, 'in'), { width: 480, height: 640 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(Math.abs(views[1].webContents.getZoomFactor() - 1) < 0.001);
  assert.ok(Math.abs(await contents.executeJavaScript('innerWidth') - Math.round(480 / 1.1)) <= 1);
  assert.equal(await views[1].webContents.executeJavaScript('innerWidth'), 480);
  applyBrowserTabZoom(contents, 1, { width: 480, height: 640 });
  contents.setAudioMuted(true);
  assert.equal(contents.isAudioMuted(), true);
  assert.equal(views[1].webContents.isAudioMuted(), false);
  check('Zoom y reset nativos; silencio independiente por pestaña');
  const pdf = await contents.printToPDF({ printBackground: true });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  fs.writeFileSync(path.join(sandbox, 'pagina.pdf'), pdf, { flag: 'wx' });
  check('Chromium genera PDF real sin impresora ni diálogo');
  const downloads = new BrowserDownloadManager(() => {}, app.getPath('downloads'));
  downloads.attach(browserSession);
  for (let index = 0; index < 2; index++) {
    contents.downloadURL(`${origin}/archivo`);
    await until(() => downloads.list().filter((record) => record.state === 'completed').length === index + 1);
  }
  const records = downloads.list();
  assert.equal(new Set(records.map((record) => record.filename)).size, 2);
  for (const record of records) assert.deepEqual(fs.readFileSync(path.join(app.getPath('downloads'), record.filename)), payload);
  check('Gestor real completa dos descargas con colisión de nombre sin sobrescribir');
  const { BrowserDiagnosticExporter } = load('integrated-browser/diagnostic-report');
  const diagnosticPath = path.join(sandbox, 'diagnostico.json');
  const originalMessageBox = dialog.showMessageBox;
  const originalSaveDialog = dialog.showSaveDialog;
  // Sólo en este harness: consentimiento simulado, ventana y filesystem reales.
  dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false });
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: diagnosticPath });
  try {
    const exporter = new BrowserDiagnosticExporter(() => ({ scopeId: 'smoke', generation: 1, changing: false, authenticated: true, parent: window }), () => ({
      startedAt: Date.now(), runtime: { appVersion: app.getVersion(), electronVersion: process.versions.electron, chromiumVersion: process.versions.chrome,
        nodeVersion: process.versions.node, profileKind: 'authenticated', protectionLevel: 'off', managed: false, checkedAt: new Date().toISOString() },
      tabs: views.length, liveViews: views.length, detachedWindows: 0, groups: 0, downloadStates: records.map((record) => record.state),
    }));
    assert.deepEqual(await exporter.exportFromDialog(), { cancelled: false, exported: true });
    const diagnosticText = fs.readFileSync(diagnosticPath, 'utf8');
    const diagnostic = JSON.parse(diagnosticText);
    assert.equal(diagnostic.runtime.electronVersion, expectedVersion);
    assert.equal(diagnostic.metrics.find((metric) => metric.id === 'downloads.completed').value, 2);
    assert.ok(!diagnosticText.includes(origin) && !diagnosticText.includes(records[0].filename));
    await assert.rejects(exporter.exportFromDialog(), /ya existe/);
    assert.equal(fs.readFileSync(diagnosticPath, 'utf8'), diagnosticText);
    check('Exportador real publica JSON saneado por enlace exclusivo y conserva un destino existente (HITL simulado)');
  } finally {
    dialog.showMessageBox = originalMessageBox; dialog.showSaveDialog = originalSaveDialog;
  }
  await history.record({ url: `${origin}/pagina-0`, title: 'Aguacate nativo' });
  await history.record({ url: `${origin}/pagina-1`, title: 'Segunda página' });
  assert.equal((await history.list({ query: 'Aguacate' })).length, 1);
  await history.flushAndClose();
  check('Historial SQLite y búsqueda FTS en el Node incluido en Electron');
  const review = await bookmarks.prepareImportHtml('<a href="https://fixture.example">Original</a><a href="file:///fixture">Inválido</a>');
  assert.deepEqual(review.summary, { total: 2, newCount: 1, duplicateCount: 0, conflictCount: 0, invalidCount: 1 });
  assert.equal((await bookmarks.list()).length, 0);
  assert.deepEqual(await review.commit('skip'), { imported: 1, updated: 0, skipped: 1 });
  check('Revisión de marcadores no escribe hasta commit y rechaza protocolos locales');
  const original = (await bookmarks.list())[0];
  const update = await bookmarks.prepareImportHtml('<a href="https://fixture.example">Actualizado</a>');
  assert.equal(update.summary.conflictCount, 1);
  assert.equal((await update.commit('update')).updated, 1);
  assert.equal((await bookmarks.list())[0].id, original.id);
  assert.ok(fs.existsSync(path.join(sandbox, 'marcadores.json.bak')));
  check('Commit de metadata preserva identidad y respaldo en disco real');
  detached = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  window.contentView.removeChildView(views[1]);
  detached.contentView.addChildView(views[1]);
  views[1].setBounds({ x: 0, y: 0, width: 640, height: 480 });
  assert.equal(views[1].webContents.getTitle(), 'Prueba nativa Pulse');
  detached.contentView.removeChildView(views[1]);
  window.contentView.addChildView(views[1]);
  detached.destroy();
  check('Una vista cambia de ventana y se reintegra sin perder su contenido');
  const snapshot = { version: 2, savedAt: new Date().toISOString(), cleanExit: false,
    activeTabId: 'principal', primaryTabId: 'principal', secondaryTabId: 'secundaria', detachedTabIds: [],
    viewMode: 'split', tabLayout: 'vertical', groups: [{ id: 'grupo', name: 'Prueba', color: 'blue', collapsed: false }],
    tabs: views.map((view, index) => ({ id: index ? 'secundaria' : 'principal', url: view.webContents.getURL(),
      title: view.webContents.getTitle(), pinned: !index, muted: !index, groupId: 'grupo', position: index })) };
  await store.save(snapshot);
  await store.save({ ...snapshot, savedAt: new Date().toISOString() });
  assert.deepEqual((await store.load()).tabs, snapshot.tabs);
  check('Sesión versionada y respaldo se guardan en disco real');
  server.closeAllConnections();
  server.close();
}

async function restore() {
  // Sólo corrompe el archivo generado por la fase anterior, dentro del sandbox.
  fs.writeFileSync(sessionPath, '{prueba de corrupción');
  const recovered = await store.load();
  assert.equal(recovered.tabs.length, 2);
  assert.equal(recovered.viewMode, 'split');
  assert.equal(recovered.tabLayout, 'vertical');
  assert.equal(recovered.groups[0].name, 'Prueba');
  assert.ok(fs.readdirSync(sandbox).some((name) => name.startsWith('sesion.json.corrupt-')));
  check('Otro proceso recupera metadata de sesión desde respaldo tras corrupción controlada');
  assert.equal((await history.list({ query: 'Aguacate' })).length, 1);
  await history.flushAndClose();
  check('Otro proceso recupera historial SQLite y su índice FTS');
  assert.equal((await bookmarks.list())[0].title, 'Actualizado');
  check('Otro proceso recupera los marcadores importados y actualizados');
  await store.save({ ...recovered, cleanExit: true });
  window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
}

app.whenReady().then(async () => {
  if (phase === 'exercise') await exercise();
  else await restore();
  let preparations = 0;
  let exits = 0;
  let approved = false;
  const guard = new ShutdownGuard({
    prepare: async () => {
      preparations++;
      const snapshot = await store.load();
      await store.save({ ...snapshot, cleanExit: true });
      assert.equal(window.isDestroyed(), false);
    },
    approve: () => { approved = true; },
    resume: () => fail(new Error('El cierre nativo no debía cancelarse.')),
    decide: async () => 'cancel',
  });
  app.on('before-quit', (event) => {
    exits++;
    if (guard.consumeQuitApproval()) return;
    event.preventDefault();
    void guard.request('quit', () => app.quit());
  });
  app.on('will-quit', () => {
    assert.equal(approved, true);
    assert.equal(preparations, 1);
    assert.equal(exits, 2);
    guard.commit();
    for (const view of views) if (!view.webContents.isDestroyed()) view.webContents.close();
    check('before-quit real espera el guardado y will-quit consume una única aprobación');
    report.status = 'passed';
    finishReport();
  });
  app.quit();
}).catch(fail);
