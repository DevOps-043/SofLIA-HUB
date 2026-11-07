const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { app, BrowserWindow } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
assert.ok(path.isAbsolute(sandbox || '') && path.basename(sandbox).startsWith('pulse-browser-smoke-'));
assert.equal(phase, 'perception'); assert.equal(process.versions.electron, expectedVersion);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'perception', name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const load = name => require(path.join(sandbox, 'compiled/integrated-browser', name + '.js'));
const { BrowserPerceptionState } = load('perception-state');
const { collectIntegratedBrowserDom } = load('page-observation');
const report = { status: 'running', phase, electron: process.versions.electron, checks: [], artifacts: [], frames: [], captureErrors: [], limitations: [],
  scope: 'Módulos productivos con Electron/DOM reales; el servicio completo y sus permisos se verifican por separado.' };
let server, window;
const check = label => { report.checks.push(label); console.log('[Smoke] OK: ' + label); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
void app.whenReady().then(async () => {
  server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" });
    response.end('<!doctype html><html lang="es"><title>Percepción de prueba</title><style>body{background:white;color:black;font-size:24px}</style><h1>Página de prueba</h1><p>Contenido local ficticio</p><button>Continuar</button></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  window = new BrowserWindow({ show: false, opacity: 0, skipTaskbar: true, width: 800, height: 600,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const contents = window.webContents;
  const painted = new Promise(resolve => window.once('ready-to-show', resolve));
  contents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') }));
  let documentToken = 0, revision = 0, policyRevision = 0;
  contents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => { if (mainFrame) { documentToken++; revision++; } });
  await contents.loadURL(origin + '/primero');
  // La carga del documento puede resolver antes de que exista un frame del compositor.
  await painted; report.firstPaintReady = true;
  const key = () => ({ tabId: 'qa', url: contents.getURL(), contents, documentToken: String(documentToken),
    loadSequence: documentToken, visualRevision: revision, sessionGeneration: 1, policyRevision, controlRevision: 0 });
  const state = new BrowserPerceptionState({ isCurrent: target => !contents.isDestroyed()
    && target.contents === contents && target.url === contents.getURL() && target.documentToken === String(documentToken)
    && target.loadSequence === documentToken && target.visualRevision === revision && target.policyRevision === policyRevision,
    describeError: error => {
      report.captureErrors.push({ name: error instanceof Error ? error.name : 'Error', message: String(error?.message || 'Fallo de QA').slice(0, 240) });
      return 'Fallo propio de QA';
    } });
  let active = 0, maximum = 0, captures = 0;
  const produce = async (target, hold) => {
    active++; maximum = Math.max(maximum, active); captures++;
    try {
      const image = await contents.capturePage(); report.frames.push({ ...image.getSize(), empty: image.isEmpty() });
      assert.equal(image.isEmpty(), false);
      const png = image.toPNG(); assert.ok(png.length > 100);
      const file = 'frame-' + captures + '.png'; fs.writeFileSync(path.join(sandbox, file), png);
      report.artifacts.push({ file, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') });
      await hold?.promise;
      return { tabId: target.tabId, url: target.url, capturedAt: new Date().toISOString(), screenshot: image.toDataURL(), revision: target.visualRevision };
    } finally { active--; }
  };
  const initial = key(), hold = deferred();
  const first = state.captureVisual(state.acquire(initial), () => produce(initial, hold));
  await tick(); state.setEnabled(false); state.setEnabled(true);
  const renewed = key(); const second = state.captureVisual(state.acquire(renewed), () => produce(renewed));
  assert.equal(captures, 1); hold.resolve(); assert.equal(await first, null);
  assert.ok(await second); assert.equal(captures, 2); assert.equal(maximum, 1);
  check('pausa/reactivación descarta frame pendiente y serializa una captura nativa nueva');

  const duplicateHold = deferred(), duplicateKey = key(), before = captures;
  const one = state.captureVisual(state.acquire(duplicateKey), () => produce(duplicateKey, duplicateHold));
  const two = state.captureVisual(state.acquire({ ...duplicateKey }), () => { throw new Error('No debe producir dos veces'); });
  await tick(); duplicateHold.resolve(); assert.deepEqual(await one, await two); assert.equal(captures, before + 1);
  check('dos solicitudes compatibles comparten un único frame nativo');

  const domKey = key();
  const observation = await state.captureObservation(state.acquire(domKey), async () => ({ tabId: domKey.tabId,
    capturedAt: new Date().toISOString(), screenshot: state.visual(domKey).screenshot,
    dom: await collectIntegratedBrowserDom(contents, { backend: 'script' }) }));
  fs.writeFileSync(path.join(sandbox, 'dom-qa.json'), JSON.stringify(observation.dom, null, 2));
  assert.equal(observation.dom.title, 'Percepción de prueba'); assert.ok(observation.dom.text.includes('Contenido local ficticio'));
  assert.ok(observation.dom.controls.some(control => control.tag === 'button' && control.text === 'Continuar' && control.name === ''));
  assert.equal(observation.sequence, 1);
  check('DOM productivo en mundo aislado y frame real se publican bajo un ciclo vigente');

  const obsoleteHold = deferred(), obsoleteKey = key();
  const obsolete = state.captureVisual(state.acquire(obsoleteKey), () => produce(obsoleteKey, obsoleteHold));
  await tick(); await contents.loadURL(origin + '/segundo'); await contents.loadURL(origin + '/primero');
  obsoleteHold.resolve(); assert.equal(await obsolete, null); assert.equal(state.visual(key()), null);
  check('navegación ABA a la misma URL no recupera un frame del documento anterior');

  const oldDom = deferred(), domPending = state.captureObservation(state.acquire(key()), async () => {
    const captured = await collectIntegratedBrowserDom(contents, { backend: 'script' }); await oldDom.promise;
    return { tabId: 'qa', capturedAt: new Date().toISOString(), screenshot: 'fixture', dom: captured };
  });
  await tick(); state.reset(); oldDom.resolve(); assert.equal(await domPending, null);
  assert.equal(state.observation(key()), null); assert.equal(state.status(4000).lastError, null);
  check('cierre lógico descarta también lectura DOM pendiente sin error del ciclo anterior');

  const policyHold = deferred(), policyKey = key();
  const policyPending = state.captureVisual(state.acquire(policyKey), () => produce(policyKey, policyHold));
  await tick(); policyRevision++; policyHold.resolve();
  assert.equal(await policyPending, null); assert.equal(state.visual(key()), null);
  check('cambio de política durante un frame nativo impide publicarlo');

  let timerCalls = 0; state.schedule(30, async () => { timerCalls++; }); state.setEnabled(false);
  await new Promise(resolve => setTimeout(resolve, 60)); assert.equal(timerCalls, 0);
  state.setEnabled(true); state.schedule(10, async () => { timerCalls++; });
  await new Promise(resolve => setTimeout(resolve, 60)); assert.equal(timerCalls, 1);
  await new Promise(resolve => setTimeout(resolve, 60)); assert.equal(timerCalls, 1);
  check('timer por evento se cancela al pausar y no se convierte en polling');
  state.reset(); report.maximumConcurrentCaptures = maximum; report.status = 'passed';
  window.destroy(); server.close(); fs.writeFileSync(path.join(sandbox, 'perception.json'), JSON.stringify(report, null, 2)); app.exit(0);
}).catch(error => {
  report.status = 'failed'; report.failure = String(error.message).slice(0, 240);
  fs.writeFileSync(path.join(sandbox, 'perception.json'), JSON.stringify(report, null, 2));
  if (window && !window.isDestroyed()) window.destroy(); server?.close(); console.error('[Smoke] Falló percepción: ' + report.failure); app.exit(1);
});
