// Zoom real por WebContents: usa el mismo módulo que el producto.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, WebContentsView } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'zoom' || process.versions.electron !== expectedVersion) { app.exit(1); }
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'zoom', name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome, phase, checks: [], limitations: [], metrics: [] };
let server, window;
const wait = () => new Promise(resolve => setTimeout(resolve, 200));
const { applyBrowserTabZoom, browserDomPoint } = require(path.join(sandbox, 'compiled', 'integrated-browser', 'tab-zoom.js'));
const check = label => { report.checks.push(label); console.log('[Smoke] OK: ' + label); };
void app.whenReady().then(async () => {
  server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><meta charset=utf-8><style>body{margin:0}button{position:absolute;left:40px;top:40px;width:100px;height:40px;background:red}</style><button onclick="window.clicks=(window.clicks||0)+1">Prueba</button>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  window = new BrowserWindow({ show: false, opacity: 0, skipTaskbar: true, width: 960, height: 640 });
  const views = [new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } }),
    new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })];
  views[0].webContents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') }));
  for (let index = 0; index < 2; index++) {
    window.contentView.addChildView(views[index]); views[index].setBounds({ x: index * 480, y: 0, width: 480, height: 640 });
    await views[index].webContents.loadURL(origin + '/' + index);
  }
  const first = views[0].webContents, second = views[1].webContents;
  // Crear superficie de composición sin una ventana visible ni tomar el foco.
  window.showInactive(); await wait();
  const metrics = contents => contents.executeJavaScript('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scale:visualViewport.scale,clicks:window.clicks||0})');
  const baseline = await metrics(second);
  for (const factor of [2, 0.5, 1.5]) {
    applyBrowserTabZoom(first, factor, { width: 480, height: 640 });
    await wait();
    const current = await metrics(first); report.metrics.push({ factor, ...current });
    assert.ok(Math.abs(current.width - Math.round(480 / factor)) <= 1);
    assert.deepEqual(await metrics(second), baseline);
    assert.equal(first.getZoomFactor(), 1); assert.equal(second.getZoomFactor(), 1);
    check('viewport independiente a factor ' + factor);
    let capture;
    for (let attempt = 0; attempt < 30 && !capture; attempt++) {
      try { capture = await first.capturePage(); }
      catch (error) { if (attempt === 29 || !String(error.message).includes('display surface')) throw error; await wait(); }
    }
    report.metrics[report.metrics.length - 1].capture = capture.getSize();
    const pixels = capture.resize({ width: 480, height: 640 }).toBitmap();
    let left = 480, right = -1, top = 640, bottom = -1;
    for (let y = 0; y < 640; y++) for (let x = 0; x < 480; x++) {
      const offset = (y * 480 + x) * 4;
      if (pixels[offset + 2] > 200 && pixels[offset + 1] < 30 && pixels[offset] < 30) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    report.metrics[report.metrics.length - 1].red = { left, right, top, bottom };
    assert.ok(Math.abs(left - 40 * factor) <= 4);
    assert.ok(Math.abs(right - 140 * factor) <= 4);
    check('la captura conserva la escala visible a factor ' + factor);
    first.focus();
    const point = browserDomPoint(first, { x: 90, y: 60 }, factor);
    first.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
    first.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await wait();
    report.metrics[report.metrics.length - 1].afterClick = await metrics(first);
    assert.equal((await metrics(first)).clicks, report.metrics.length);
    check('entrada nativa apunta al botón visible a factor ' + factor);
  }
  applyBrowserTabZoom(first, 1, { width: 480, height: 640 }); await wait(); assert.equal((await metrics(first)).width, baseline.width);
  check('restablecer devuelve el viewport sin afectar la otra pestaña');
  applyBrowserTabZoom(first, 2, { width: 480, height: 640 });
  await first.loadURL(origin + '/recarga'); applyBrowserTabZoom(first, 2, { width: 480, height: 640 }); await wait();
  assert.equal((await metrics(first)).width, 240); assert.deepEqual(await metrics(second), baseline);
  check('navegación conserva zoom y sesión sin propagar a su vecina');
  views[0].setBounds({ x: 0, y: 0, width: 600, height: 640 });
  applyBrowserTabZoom(first, 2, { width: 600, height: 640 }); await wait(); assert.equal((await metrics(first)).width, 300);
  check('redimensionado recalcula el viewport lógico');
  const pdf = await first.printToPDF({ printBackground: true }); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  check('impresión PDF disponible con zoom emulado');
  report.scope = 'Verificación focalizada; no smoke del producto completo ni accesibilidad con lector de pantalla.';
  report.status = 'passed'; window.destroy(); server.close();
  fs.writeFileSync(path.join(sandbox, 'zoom.json'), JSON.stringify(report, null, 2)); app.exit(0);
}).catch(error => {
  report.failure = String(error.message).slice(0, 300);
  report.status = 'failed'; fs.writeFileSync(path.join(sandbox, 'zoom.json'), JSON.stringify(report, null, 2));
  if (window && !window.isDestroyed()) window.destroy(); server?.close(); console.error('[Smoke] Falló el diagnóstico de zoom.'); app.exit(1);
});
