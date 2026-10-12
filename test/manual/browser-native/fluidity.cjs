// Servicio compilado y Electron reales, perfil temporal y contenido en loopback.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const root = path.resolve(process.argv[2]);
const output = process.argv[3];
assert.ok(path.isAbsolute(output), 'La evidencia requiere una ruta absoluta.');
const log = message => fs.appendFileSync(output + '.log', message + '\n');
log('Inicio de la sonda');
let cleanup = () => {};
setTimeout(() => { log('Tiempo de prueba agotado'); cleanup(); process.exit(1); }, 30_000).unref();
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-browser-fluidity-')));
process.env.BROWSER_PAGE_TOOLS_ENABLED = 'true';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  log('Electron listo');
  const entry = fs.readFileSync(path.join(root, 'dist-electron/main.js'), 'utf8');
  const chunk = entry.match(/integrated-browser-[A-Za-z0-9_]+\.js/)[0];
  const exports = Object.values(require(path.join(root, 'dist-electron', chunk)))
    .flatMap(value => value && typeof value === 'object' ? Object.values(value) : [value]);
  const Service = exports.find(value => typeof value === 'function' && value.prototype?.attachWindow && value.prototype?.open);
  assert.ok(Service, 'Falta el servicio real compilado.');
  log('Servicio cargado');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    response.end('<style>@keyframes mover{to{transform:translateX(200px)}}div{width:40px;height:40px;background:teal;animation:mover 1s infinite alternate}</style><div></div><script>window.framesSeen=0;function frame(){window.framesSeen++;requestAnimationFrame(frame)}frame()</script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/page`;
  // La ventana no se ve ni toma foco; Chromium sí recibe una superficie mostrada.
  // Una ventana nunca mostrada no constituye una prueba válida de requestAnimationFrame.
  const parent = new BrowserWindow({ show: false, opacity: 0, skipTaskbar: true, focusable: false, width: 1000, height: 800 });
  parent.showInactive();
  const browser = new Service(); browser.attachWindow(parent);
  cleanup = () => { browser.detachWindow(); parent.destroy(); server.close(); };
  log('Ventana temporal adjunta');
  browser.setObservationEnabled(false);
  await browser.open(url);
  log('Primera página local cargada');
  browser.setViewport({ x: 200, y: 100, width: 800, height: 600 });
  const firstId = browser.getState().activeTabId;
  const contents = browser.getWebContentsForAgent();
  await browser.createTab(url + '?second');
  log('Segunda página local cargada');
  const secondId = browser.getState().activeTabId;
  browser.activateTab(firstId);
  for (let index = 0; index < 5; index++) browser.setZoom('in');
  // Contar llamadas nativas, no solamente metadatos del servicio.
  const original = contents.enableDeviceEmulation.bind(contents);
  const originalZoom = contents.setZoomFactor.bind(contents);
  const isolatedZoom = typeof contents.setZoomMode === 'function';
  let emulations = 0;
  let zoomMutations = 0;
  contents.enableDeviceEmulation = (...args) => { emulations++; return original(...args); };
  contents.setZoomFactor = (...args) => { zoomMutations++; return originalZoom(...args); };
  const started = performance.now();
  for (let index = 0; index < 100; index++) {
    browser.activateTab(secondId); browser.activateTab(firstId);
  }
  const switchMs = performance.now() - started;
  assert.equal(emulations, 0, 'Alternar reinició emulación sin cambiar factor ni tamaño.');
  assert.equal(zoomMutations, 0, 'Alternar reaplicó un factor nativo idéntico.');
  log('Alternancia verificada');
  // El renderer reserva el espacio de sugerencias publicando este rectángulo.
  browser.setViewport({ x: 200, y: 300, width: 800, height: 400 });
  const view = parent.contentView.children.find(child => child.webContents === contents);
  assert.ok(view.getVisible(), 'La superficie se ocultó al reservar espacio.');
  const before = await contents.executeJavaScript('window.framesSeen');
  await pause(400);
  const after = await contents.executeJavaScript('window.framesSeen');
  // Opacidad cero evita interrumpir al usuario, pero Windows puede considerar
  // la ventana ocluida. Registrar el resultado sin acreditarlo como animación visible.
  const animationConfirmed = after > before + 2;
  browser.setViewport({ x: 200, y: 100, width: 800, height: 600 });
  assert.ok(view.getVisible(), 'No se restauró la página viva.');
  const beforeReload = emulations;
  await browser.navigate(url);
  // loadURL puede resolver antes de did-stop-loading; conservar esa barrera.
  const deadline = performance.now() + 5_000;
  while (contents.isLoadingMainFrame()) {
    assert.ok(performance.now() < deadline, 'La recarga no terminó.'); await pause(10);
  }
  if (!isolatedZoom) assert.ok(emulations > beforeReload, 'La recarga no invalidó la emulación.');
  else assert.equal(contents.getZoomFactor(), 1.5, 'La recarga perdió el zoom nativo.');
  const report = { electron: process.versions.electron, chromium: process.versions.chrome,
    switches: 200, totalSwitchMs: switchMs, meanSwitchMs: switchMs / 200,
    isolatedZoom, repeatedSwitchEmulations: 0, repeatedSwitchZoomMutations: zoomMutations,
    framesDuringReservedViewport: after - before,
    animationConfirmed, animationTestWindowOpacity: 0,
    reservedViewportKeepsViewVisible: true, sameUrlReloadReappliesZoom: true,
    remotePageTested: false, rendererDropdownTested: false };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log('[Fluidez] ' + JSON.stringify(report));
  cleanup(); process.exit(0);
}).catch(error => { log(error.stack || error.message); console.error('[Fluidez] ' + error.message); cleanup(); process.exit(1); });
