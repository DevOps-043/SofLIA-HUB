const { app, BrowserWindow, shell, session } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

assert.equal(process.versions.electron, process.argv[2]);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(__dirname, 'profile', name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.on('window-all-closed', () => {});
const checks = [];
const callback = async target => new Promise((resolve, reject) => {
  http.get({ hostname: '127.0.0.1', port: 8234, path: target, agent: false }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', text => { body += text; });
    response.once('end', () => resolve({ status: response.statusCode, body }));
  }).once('error', reject);
});
async function assertReleased() {
  assert.equal(BrowserWindow.getAllWindows().length, 0);
  const probe = http.createServer();
  await new Promise((resolve, reject) => probe.once('error', reject).listen(8234, '127.0.0.1', resolve));
  await new Promise(resolve => probe.close(resolve));
}

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, done) => done({ cancel: !details.url.startsWith('data:') }));
  globalThis.fetch = () => { throw new Error('Red externa bloqueada en QA OAuth.'); };
  // Sólo este proceso de QA: ventana nativa real sin mostrarla o tomar foco.
  BrowserWindow.prototype.show = function () {};
  const { createOAuthProof } = require('./electron/calendar/oauth-proof');
  const { openOAuthWindow } = require('./electron/calendar/oauth-window');
  const { setAuthState } = require('./electron/main/auth-state');
  const make = (assertCurrent = () => {}) => {
    const proof = createOAuthProof(); const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: 'cliente-ficticio', response_type: 'code', state: proof.state,
      redirect_uri: 'http://localhost:8234/callback', code_challenge: proof.challenge, code_challenge_method: 'S256' }).toString();
    return { proof, auth, options: { provider: 'google', clientId: 'cliente-ficticio', proof, assertCurrent } };
  };
  let opened = 0;
  const first = make();
  shell.openExternal = async url => {
    opened++; assert.equal(url, first.auth.href);
    const windows = BrowserWindow.getAllWindows(); assert.equal(windows.length, 1);
    const win = windows[0], preferences = win.webContents.getLastWebPreferences();
    assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
    assert.equal(win.isVisible(), false); assert.ok(win.webContents.getURL().startsWith('data:'));
    const content = await win.webContents.executeJavaScript('({text:document.body.innerText,node:typeof require,iframes:document.querySelectorAll("iframe").length})');
    assert.ok(content.text.includes('Continúa en tu navegador')); assert.ok(!content.text.includes(first.proof.state));
    assert.equal(content.node, 'undefined'); assert.equal(content.iframes, 0); checks.push('ventana-local-sandbox-sin-proveedor-ni-prueba');
    assert.equal((await callback('/callback?state=ajeno&code=ficticio')).status, 403); checks.push('state-ajeno-rechazado-en-listener-real');
    const response = await callback('/callback?state=' + first.proof.state + '&code=codigo-ficticio');
    assert.equal(response.status, 200); assert.ok(!response.body.includes('codigo-ficticio')); checks.push('callback-vigente-sin-reflejar-codigo');
  };
  assert.equal(await openOAuthWindow(first.auth.href, 'Google Calendar', first.options), 'codigo-ficticio');
  await assertReleased(); checks.push('resultado-despues-de-liberar-puerto-y-ventana');

  shell.openExternal = async () => { opened++; BrowserWindow.getAllWindows()[0].close(); };
  const second = make(); assert.equal(await openOAuthWindow(second.auth.href, 'Google Calendar', second.options), null);
  await assertReleased(); checks.push('cerrar-ventana-cancela-y-permite-reintentar');

  let current = true;
  shell.openExternal = async () => { opened++; current = false; setAuthState({ authenticated: true, userId: 'otro-ficticio' }); };
  const third = make(() => { if (!current) throw new Error('Sesión ficticia revocada'); });
  await assert.rejects(openOAuthWindow(third.auth.href, 'Google Calendar', third.options));
  await assertReleased(); checks.push('sesion-revocada-retira-intento-nativo');

  shell.openExternal = async () => { opened++; throw new Error('Apertura ficticia fallida'); };
  const fourth = make(); await assert.rejects(openOAuthWindow(fourth.auth.href, 'Google Calendar', fourth.options));
  await assertReleased(); checks.push('fallo-de-apertura-no-retiene-recursos');

  const fifth = make(); fifth.auth.hostname = 'ajeno.invalid';
  await assert.rejects(openOAuthWindow(fifth.auth.href, 'Google Calendar', fifth.options));
  await assertReleased(); assert.equal(opened, 4); checks.push('destino-ajeno-no-se-abre');
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify({ status: 'passed', electron: process.versions.electron,
    checks, externalBrowserMocked: true, realCredentialsUsed: false, realProviderAuthenticated: false }, null, 2));
  app.exit(0);
}).catch(error => {
  fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify({ status: 'failed', checks,
    failure: String(error.message).slice(0, 400), realCredentialsUsed: false }, null, 2));
  console.error('[OAuth nativo] Falló la verificación; revisar el temporal sin datos reales.'); app.exit(1);
});
