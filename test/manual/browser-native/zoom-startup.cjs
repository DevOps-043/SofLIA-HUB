// Regresión nativa: emular antes de la primera carga cerraba el proceso main.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, WebContentsView } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'zoom-startup' || process.versions.electron !== expectedVersion) app.exit(1);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, phase, name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const { applyBrowserTabZoom } = require(path.join(sandbox, 'compiled', 'integrated-browser', 'tab-zoom.js'));
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome, phase, checks: [], limitations: [] };
const check = label => { report.checks.push(label); console.log('[Smoke] OK: ' + label); };
const wait = () => new Promise(resolve => setTimeout(resolve, 150));
const load = async (contents, url) => {
  const stopped = new Promise(resolve => contents.once('did-stop-loading', resolve));
  await Promise.all([contents.loadURL(url), stopped]);
};
let window, server;
const views = [];
function finish(code, error) {
  report.status = code === 0 ? 'passed' : 'failed';
  if (error) report.failure = String(error.message).slice(0, 300);
  fs.writeFileSync(path.join(sandbox, phase + '.json'), JSON.stringify(report, null, 2));
  for (const view of views) if (view.webContents && !view.webContents.isDestroyed()) view.webContents.close();
  if (window && !window.isDestroyed()) window.destroy();
  server?.close(); app.exit(code);
}
void app.whenReady().then(async () => {
  server = http.createServer((request, response) => {
    const send = () => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Prueba local</title>Zoom'); };
    if (request.url === '/lenta') setTimeout(send, 400); else send();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  window = new BrowserWindow({ show: false, frame: false, width: 960, height: 640 });
  for (const factor of [1, 2]) {
    const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    views.push(view); window.contentView.addChildView(view);
    const contents = view.webContents;
    contents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') }));
    assert.equal(contents.getURL(), '');
    applyBrowserTabZoom(contents, factor, null);
    view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
    applyBrowserTabZoom(contents, factor, { width: 800, height: 600 });
    check('primera vista antes de cargar, factor ' + factor);
    await load(contents, origin + '/inicio');
    applyBrowserTabZoom(contents, factor, { width: 800, height: 600 }); await wait();
    assert.equal(await contents.executeJavaScript('innerWidth'), 800 / factor);
    check('zoom aplicado después de cargar, factor ' + factor);
    const loading = load(contents, origin + '/lenta');
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 });
    await loading;
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 }); await wait();
    assert.equal(await contents.executeJavaScript('innerWidth'), 400);
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 }); await wait();
    assert.equal(await contents.executeJavaScript('innerWidth'), 800);
    check('navegación lenta y restablecimiento, factor ' + factor);
    const gone = new Promise(resolve => contents.once('render-process-gone', resolve));
    contents.forcefullyCrashRenderer(); await gone;
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 });
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 });
    await load(contents, origin + '/recuperada');
    applyBrowserTabZoom(contents, 2, { width: 800, height: 600 }); await wait();
    assert.equal(await contents.executeJavaScript('innerWidth'), 400);
    check('renderer caído y recarga, factor ' + factor);
    contents.close();
    applyBrowserTabZoom(contents, 1, { width: 800, height: 600 });
    check('vista destruida ignorada, factor ' + factor);
  }
  assert.equal(window.isDestroyed(), false);
  check('ventana anfitriona conservada sin desactivar GPU');
  finish(0);
}).catch(error => { console.error('[Smoke] Fallo de arranque/zoom:', error.message); finish(1, error); });
