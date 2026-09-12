// Sólo formulario ficticio en loopback; ventana oculta, sin perfiles del producto.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'autosave' || process.versions.electron !== expectedVersion) {
  console.error('[Smoke] Parámetros de guardado sugerido inválidos.'); app.exit(1);
}
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'autosave', name);
  fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const load = (name) => require(path.join(sandbox, 'compiled', 'integrated-browser', name + '.js'));
const { BrowserCredentialAutosave } = load('credential-autosave');
const { acquireCdpLease } = load('cdp-session');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  node: process.versions.node, phase, checks: [], limitations: [] };
function check(label) { report.checks.push(label); console.log('[Smoke] OK: ' + label); }
const wait = () => new Promise((resolve) => setTimeout(resolve, 150));
let server; let window;
void app.whenReady().then(async () => {
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Formulario ficticio</title>
    <form id="login" method="post"><input autocomplete="username" value="cuenta-ficticia">
    <input type="password" autocomplete="current-password" value="Ficticia-Nativa-93!">
    <button id="submit">Enviar</button></form>
    <script>document.getElementById('login').addEventListener('submit', (event) => event.preventDefault());</script></html>`;
  server = http.createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  window = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const contents = window.webContents;
  contents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') && details.url !== 'about:blank' }));
  await contents.loadURL(origin + '/login');
  let inputLease = await acquireCdpLease(contents, ['Page', 'Runtime']);
  const offers = [];
  const observer = new BrowserCredentialAutosave(contents, (candidate) => offers.push({ ...candidate }));
  assert.equal(await observer.install(), true);
  await wait();
  assert.equal(await contents.executeJavaScript('typeof globalThis.__sofliaCredentialCandidate'), 'undefined');
  check('el puente de credenciales no existe en el mundo principal del sitio');
  await contents.executeJavaScript("document.getElementById('submit').click(); document.getElementById('login').requestSubmit();");
  await wait();
  assert.equal(offers.length, 0);
  check('click JavaScript y requestSubmit sin gesto no generan candidatos');
  async function clickButton() {
    // Dejar vencer la cuota; los casos negativos deben probar su guarda, no el deduplicador.
    await new Promise(resolve => setTimeout(resolve, 1_050));
    const point = await contents.executeJavaScript("(() => { const r = document.getElementById('submit').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()");
    await inputLease.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
    await inputLease.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...point });
    await wait();
  }
  await clickButton();
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0], { origin, username: 'cuenta-ficticia', password: 'Ficticia-Nativa-93!' });
  offers.length = 0;
  check('gesto confiable de Chromium entrega sólo el formulario principal al puente privado');
  await contents.executeJavaScript("document.getElementById('login').action = 'https://otro.example/login'");
  await clickButton();
  assert.equal(offers.length, 0);
  check('formulario con destino de otro origen no genera sugerencia');
  await contents.executeJavaScript("document.getElementById('login').action = location.href; document.getElementById('submit').type = 'button'; document.getElementById('submit').textContent = 'Iniciar sesión';");
  await clickButton();
  assert.equal(offers.length, 1); offers.length = 0;
  check('botón SPA con gesto confiable ofrece cuenta sin evento submit');
  await contents.executeJavaScript("document.body.innerHTML = '<input autocomplete=username value=cuenta-ficticia><input type=password value=Ficticia-Nativa-93!><button id=submit type=button>Acceder</button>'");
  await clickButton();
  assert.equal(offers.length, 1);
  assert.equal(offers[0].origin, origin); offers.length = 0;
  check('controles sin form mantienen el origen del documento');
  await contents.executeJavaScript("document.getElementById('submit').click()");
  await wait(); assert.equal(offers.length, 0);
  check('el botón SPA sintético no genera candidatos');
  await contents.executeJavaScript("document.body.insertAdjacentHTML('afterbegin', '<input autocomplete=username value=cuenta-ambigua>')");
  await clickButton(); assert.equal(offers.length, 0);
  check('campos ambiguos sin formulario no generan candidatos');
  await contents.loadURL(origin + '/recarga');
  await wait();
  await clickButton();
  assert.equal(offers.length, 1);
  offers.length = 0;
  check('el observador reaparece en una navegación del sitio');
  contents.debugger.detach();
  await wait();
  inputLease = await acquireCdpLease(contents, ['Page', 'Runtime']);
  assert.equal(await observer.install(), true);
  await clickButton();
  assert.equal(offers.length, 1);
  offers.length = 0;
  check('el observador se recupera tras perder la sesión CDP sin duplicar candidatos');
  await observer.dispose();
  await clickButton();
  assert.equal(offers.length, 0);
  await inputLease.release();
  check('desactivar elimina listeners del documento actual y no captura nuevos envíos');
  window.destroy(); server.close();
  report.status = 'passed';
  await fsp.writeFile(path.join(sandbox, 'autosave.json'), JSON.stringify(report, null, 2));
  app.exit(0);
}).catch(async () => {
  report.status = 'failed';
  // La causa puede incluir la credencial ficticia; ni siquiera ésta sale al log.
  report.failure = 'Falló una comprobación del observador nativo.';
  await fsp.writeFile(path.join(sandbox, 'autosave.json'), JSON.stringify(report, null, 2)).catch(() => {});
  if (window && !window.isDestroyed()) window.destroy();
  server?.close();
  console.error('[Smoke] Falló el observador nativo; revisar la última comprobación.');
  app.exit(1);
});
