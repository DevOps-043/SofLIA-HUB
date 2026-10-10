// Sonda local del servicio compilado: no carga bootstrap, .env ni perfiles reales.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const root = path.resolve(process.argv[2]);
const output = process.argv[3];
assert.ok(path.isAbsolute(output), 'Se exige una ruta absoluta para la evidencia.');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-browser-latency-')));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const entry = fs.readFileSync(path.join(root, 'dist-electron/main.js'), 'utf8');
  const chunk = entry.match(/integrated-browser-[A-Za-z0-9_]+\.js/)[0];
  const exported = Object.values(require(path.join(root, 'dist-electron', chunk))).flatMap(value => value && typeof value === 'object' ? Object.values(value) : [value]);
  const Service = exported.find(value => typeof value === 'function' && value.prototype?.attachWindow && value.prototype?.open);
  assert.ok(Service, 'Falta el servicio real en el build indicado.');
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url.startsWith('/asset')) {
      setTimeout(() => { response.writeHead(200, { 'Content-Type': 'image/svg+xml' }); response.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }, 750);
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(request.url.startsWith('/frame') ? '<p>Texto del frame</p>' : '<h1>Página local</h1><img src="/asset">' + Array.from({ length: 12 }, (_, index) => `<iframe src="/frame/${index}"></iframe>`).join(''));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/page`;
  const parent = new BrowserWindow({ show: false });
  const service = new Service(); service.attachWindow(parent);
  const waitForIdle = async contents => {
    const deadline = performance.now() + 5000;
    while (contents.isLoading() || service.getState().isLoading) {
      assert.ok(performance.now() < deadline, 'La página local no terminó dentro de su presupuesto.');
      await pause(10);
    }
  };
  const durations = {};
  let start = performance.now();
  await service.open(url, { waitForLoad: false });
  durations.openAckMs = performance.now() - start;
  let contents = parent.contentView.children.find(child => child.webContents).webContents;
  await waitForIdle(contents);
  start = performance.now();
  await service.navigate(url + '?second', undefined, { waitForLoad: false });
  durations.navigateAckMs = performance.now() - start;
  await waitForIdle(contents);
  start = performance.now();
  await service.createTab(url + '?tab', true, undefined, { waitForLoad: false });
  durations.tabAckMs = performance.now() - start;
  contents = service.getActiveTab().view.webContents;
  await waitForIdle(contents);
  await pause(250);
  service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
  let emissions = 0;
  service.on('state-changed', () => emissions++);
  start = performance.now();
  for (let index = 0; index < 100; index++) service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
  durations.repeatedViewportMs = performance.now() - start;
  let selectionReads = 0;
  const prototype = Object.getPrototypeOf(contents.mainFrame);
  const execute = prototype.executeJavaScript;
  prototype.executeJavaScript = function (script, ...args) {
    if (script.includes('return s ? String(s)')) selectionReads++;
    return execute.call(this, script, ...args);
  };
  for (let index = 0; index < 5; index++) { contents.emit('input-event', {}, { type: 'keyUp', key: 'a' }); await pause(220); }
  prototype.executeJavaScript = execute;
  const repeatedViewportEmissions = emissions;
  // Una recarga de la interfaz elimina el panel React pero no sus vistas nativas.
  await parent.loadURL('data:text/html,<main>Chat local</main>');
  service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
  const reloaded = new Promise(resolve => parent.webContents.once('did-finish-load', resolve));
  parent.webContents.reload();
  await reloaded;
  assert.equal(service.getState().isVisible, false, 'La página quedó superpuesta al chat tras recargar.');
  assert.ok(parent.contentView.children.filter(child => child.webContents).every(child => !child.getVisible()), 'Una vista nativa quedó visible sin panel.');
  await service.open();
  assert.equal(service.getState().isVisible, false, 'Abrir sin geometría revivió la vista huérfana.');
  service.setViewport({ x: 0, y: 0, width: 800, height: 600 });
  assert.equal(service.getState().isVisible, true, 'El panel no pudo reabrir el navegador.');
  const report = { electron: process.versions.electron, slowAssetMs: 750, frameCount: 12, ...durations, repeatedViewportEmissions, ordinaryInputSelectionReads: selectionReads, rendererReloadHidesWorkspace: true, reopenRequiresViewport: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log('[Latencia] ' + JSON.stringify(report));
  service.detachWindow(); parent.destroy(); server.close(); app.quit();
}).catch(error => { console.error('[Latencia] Fallo: ' + error.message); app.exit(1); });
