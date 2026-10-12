// Portada compilada en Chromium real; sin bootstrap, .env, red ni perfiles del usuario.
const { app, BrowserWindow, nativeTheme, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const home = 'soflia-inicio://inicio/';
protocol.registerSchemesAsPrivileged([{ scheme: 'soflia-inicio', privileges: { standard: true, secure: true } }]);
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-browser-home-')));
let cleanup = () => {};
let stage = 'inicio';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
setTimeout(() => { cleanup(); process.exit(1); }, 45_000).unref();

app.whenReady().then(async () => {
  const entry = fs.readFileSync(path.join(root, 'dist-electron/main.js'), 'utf8');
  const chunk = entry.match(/integrated-browser-[A-Za-z0-9_]+\.js/)[0];
  const exports = Object.values(require(path.join(root, 'dist-electron', chunk)))
    .flatMap(value => value && typeof value === 'object' ? Object.values(value) : [value]);
  const Service = exports.find(value => typeof value === 'function' && value.prototype?.attachWindow && value.prototype?.open);
  assert.ok(Service, 'Falta el servicio compilado.');
  const parent = new BrowserWindow({ show: false, opacity: 0, skipTaskbar: true, focusable: false, width: 1200, height: 860 });
  const browser = new Service();
  let preview;
  cleanup = () => { browser.detachWindow(); preview?.destroy(); parent.destroy(); };
  browser.attachWindow(parent); browser.setObservationEnabled(false);
  const started = performance.now();
  await browser.open();
  const startupMs = performance.now() - started;
  browser.setViewport({ x: 0, y: 0, width: 1200, height: 820 });
  const contents = browser.getWebContentsForAgent();
  let remoteRequests = 0;
  contents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
    remoteRequests++; callback({ cancel: true });
  });
  assert.equal(browser.getState().url, home);
  // Una vista nativa en ventana oculta carece de superficie Viz para capturas.
  // Renderizar el mismo documento/sesión en un compositor offscreen para QA.
  stage = 'compositor offscreen';
  preview = new BrowserWindow({ show: false, width: 1200, height: 820, webPreferences: {
    offscreen: true, session: contents.session, sandbox: true, contextIsolation: true, nodeIntegration: false,
  } });
  await preview.loadURL(home);
  const scriptExecuted = await preview.webContents.executeJavaScript(`(() => {
    const script = document.createElement('script');
    script.textContent = 'globalThis.homeScriptExecuted = true';
    document.head.append(script);
    return globalThis.homeScriptExecuted === true;
  })()`);
  assert.equal(scriptExecuted, false, 'La CSP debe bloquear scripts del documento.');
  const inspect = () => contents.executeJavaScript(`({
    url: location.href, title: document.title,
    background: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(document.body).color,
    overflow: document.documentElement.scrollWidth > innerWidth,
    verticalOverflow: document.body.scrollHeight > innerHeight,
    removedElements: document.querySelectorAll('.masthead, .orbit, footer').length,
    logoLoaded: document.querySelector('.logo').complete && document.querySelector('.logo').naturalWidth > 0,
    logoAnimation: getComputedStyle(document.querySelector('.logo')).animationName,
    resources: performance.getEntriesByType('resource').map(entry => entry.name.startsWith('data:') ? 'data:image/png (incluida)' : entry.name),
    node: typeof require, preload: typeof window.integratedBrowser,
    fieldLabel: document.querySelector('label[for="query"]').textContent,
    formAction: document.querySelector('form').action
  })`);
  const themes = {};
  for (const mode of ['light', 'dark']) {
    stage = `tema ${mode}`;
    nativeTheme.themeSource = mode;
    await pause(180);
    themes[mode] = await inspect();
    assert.equal(themes[mode].logoLoaded, true);
    assert.equal(themes[mode].overflow, false);
    assert.equal(themes[mode].verticalOverflow, false);
    assert.equal(themes[mode].removedElements, 0);
    assert.equal(themes[mode].url, home);
    assert.equal(themes[mode].node, 'undefined');
    assert.equal(themes[mode].preload, 'undefined');
    assert.ok(themes[mode].resources.every(url => !/^https?:/.test(url)));
    fs.writeFileSync(output + '.' + mode + '.png', (await preview.webContents.capturePage()).toPNG());
  }
  assert.notEqual(themes.light.background, themes.dark.background);
  assert.equal(themes.light.background, 'rgb(249, 250, 251)');
  assert.equal(themes.dark.background, 'rgb(15, 20, 25)');
  assert.equal(remoteRequests, 0);
  const view = parent.contentView.children.find(child => child.webContents === contents);
  assert.ok(view);
  browser.setViewport({ x: 0, y: 0, width: 1200, height: 820, homeInShell: true });
  assert.equal(view.getVisible(), false);
  assert.equal(browser.getState().url, home);
  browser.setViewport({ x: 0, y: 0, width: 1200, height: 820, homeInShell: false });
  assert.equal(view.getVisible(), true);
  // La sonda nunca envía la búsqueda: observa y cancela la navegación antes de red.
  const navigation = new Promise(resolve => contents.once('will-navigate', (event) => {
    event.preventDefault(); resolve(event.url);
  }));
  stage = 'formulario';
  await contents.executeJavaScript("document.querySelector('#query').value = 'ideas & diseño'; document.querySelector('form').requestSubmit()");
  const searchUrl = await navigation;
  assert.equal(new URL(searchUrl).origin, 'https://www.google.com');
  assert.equal(new URL(searchUrl).searchParams.get('q'), 'ideas & diseño');
  assert.equal(remoteRequests, 0);
  const phases = {};
  for (const name of ['createTabRuntime', 'materializeTab', 'loadTabTarget']) {
    const original = browser[name];
    browser[name] = function (...args) {
      const start = performance.now();
      const record = () => { (phases[name] ??= []).push(performance.now() - start); };
      const result = original.apply(this, args);
      if (result?.then) return result.finally(record);
      record(); return result;
    };
  }
  const tabStarted = performance.now();
  await browser.createTab(undefined, true, undefined, { waitForLoad: false });
  const newTabAcknowledgementMs = performance.now() - tabStarted;
  stage = 'recarga y movimiento reducido';
  assert.equal(browser.getState().url, home);
  const second = browser.getWebContentsForAgent();
  if (second.isLoadingMainFrame()) await new Promise(resolve => second.once('did-finish-load', resolve));
  const newTabReadyMs = performance.now() - tabStarted;
  await second.loadURL(home);
  assert.equal(await second.executeJavaScript('document.title'), 'Inicio · SofLIA');
  const ownsDebugger = !second.debugger.isAttached();
  if (ownsDebugger) second.debugger.attach('1.3');
  await second.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await second.executeJavaScript("getComputedStyle(document.querySelector('.logo')).animationName"), 'none');
  if (ownsDebugger) second.debugger.detach();
  browser.setViewport({ x: 0, y: 0, width: 320, height: 600 });
  stage = 'ancho 320';
  assert.equal(await second.executeJavaScript('document.documentElement.scrollWidth > innerWidth'), false);
  fs.writeFileSync(output, JSON.stringify({ electron: process.versions.electron, chromium: process.versions.chrome,
    startupMs, newTabAcknowledgementMs, newTabReadyMs, phases, remoteRequests, searchUrl, shellHomeComposition: true, scriptBlocked: !scriptExecuted, reducedMotion: true, responsive320: true, themes,
    animation: 'CSS verificado; esta ventana oculta no mide fluidez visible ni FPS.' }, null, 2));
  cleanup(); process.exit(0);
}).catch(error => {
  fs.writeFileSync(output + '.error.log', `${stage}\n${String(error.stack || error)}`);
  cleanup(); process.exit(1);
});
