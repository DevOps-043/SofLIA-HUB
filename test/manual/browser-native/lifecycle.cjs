// Prueba nativa del coordinador de cierre; no arranca el bootstrap del producto.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'lifecycle' || process.versions.electron !== expectedVersion) {
  console.error('[Smoke] Parámetros de lifecycle inválidos.');
  app.exit(1);
}
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'lifecycle', name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const load = (name) => require(path.join(sandbox, 'compiled', name + '.js'));
const { registerAppLifecycle } = load('main/app-lifecycle');
const { BrowserBookmarkStore } = load('integrated-browser/bookmark-store');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  node: process.versions.node, phase, checks: [], limitations: [] };
const reportPath = path.join(sandbox, 'lifecycle.json');
function check(label) { report.checks.push(label); console.log('[Smoke] OK: ' + label); }
function writeReport() { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); }
function fail(error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : 'Fallo nativo';
  writeReport();
  console.error('[Smoke] Falló:', report.error);
  app.exit(1);
}
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
setTimeout(() => fail(new Error('El lifecycle nativo superó 30 segundos.')), 30_000).unref();

void app.whenReady().then(async () => {
  const root = path.join(sandbox, 'lifecycle', 'perfil-temporal');
  const bookmarks = new BrowserBookmarkStore(path.join(root, 'bookmarks.json'));
  await bookmarks.save({ url: 'https://example.test/', title: 'Temporal' });
  const profile = session.fromPartition('pulse-smoke-private-lifecycle');
  await profile.cookies.set({ url: 'https://example.test', name: 'smoke', value: 'temporal' });
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const state = { win: window, isQuitting: false, tray: null };
  let closed = false;
  let stopped = false;
  let cleaned = false;
  let cleanupCalls = 0;
  let cleanupPromise = Promise.resolve();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const services = {
    integratedBrowserService: {
      flushSessionForShutdown: () => bookmarks.flush(),
      commitShutdown: () => {},
      resumeAfterShutdown: () => {},
      flushClosedProfileForShutdown: () => { cleanupCalls++; return cleanupPromise; },
    },
    updaterService: { setInstallGuard: () => {}, stop: () => {} },
    pathMemoryService: { stop: () => { stopped = true; } },
    clipboardAssistant: { stop: () => {} },
    meetingPassiveDetectionService: { stopPolling: () => {} },
  };
  const controls = {
    createWindow: () => fail(new Error('No se esperaba recrear una ventana.')),
    routeShareLinkToRenderer: () => {}, routeAuthCallbackToRenderer: () => {}, routeMeetingTriggerToRenderer: () => {},
  };
  registerAppLifecycle({ services, state, controls });
  // El contenido existía antes del registro del lifecycle: enlazar su evento.
  app.emit('web-contents-created', {}, window.webContents);
  window.once('closed', () => {
    closed = true;
    state.win = null;
    cleanupPromise = held.then(async () => {
      await bookmarks.flush();
      await profile.clearStorageData();
      await profile.clearCache();
      await profile.clearAuthCache();
      await fsp.rm(root, { recursive: true, force: true });
      assert.equal((await profile.cookies.get({ url: 'https://example.test' })).length, 0);
      cleaned = true;
    });
  });
  await window.loadURL('data:text/html;charset=utf-8,<title>Cierre de prueba</title>');
  await window.webContents.executeJavaScript('window.onbeforeunload = () => false; void 0');
  const canceled = new Promise((resolve) => window.webContents.once('will-prevent-unload', resolve));
  app.quit();
  await canceled;
  assert.equal(state.isQuitting, false);
  assert.equal(closed, false);
  assert.equal(cleanupCalls, 0);
  assert.equal((await profile.cookies.get({ url: 'https://example.test' })).length, 1);
  assert.equal((await bookmarks.list()).length, 1);
  check('beforeunload cancelado conserva ventana, cookie y marcadores');
  await window.webContents.executeJavaScript('window.onbeforeunload = null');
  let quits = 0;
  app.on('will-quit', (event) => {
    quits++;
    assert.equal(closed, true);
    if (quits === 1) {
      assert.equal(event.defaultPrevented, true);
      assert.equal(stopped, false);
      setTimeout(() => {
        assert.equal(cleaned, false);
        assert.equal(fs.existsSync(root), true);
        check('will-quit mantiene el proceso vivo mientras termina la limpieza');
        release();
      }, 100);
      return;
    }
    assert.equal(quits, 2);
    assert.equal(cleaned, true);
    assert.equal(stopped, true);
    assert.equal(fs.existsSync(root), false);
    assert.equal(cleanupCalls, 1);
    check('salida final única después de borrar cookies y archivos temporales');
    report.status = 'passed';
    writeReport();
  });
  app.quit();
}).catch(fail);
