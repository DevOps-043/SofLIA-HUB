// Fixture aislado: autenticador virtual desechable, nunca registra claves del usuario.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow, WebContentsView, dialog } = require('electron');
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-browser-smoke-')
  || phase !== 'passkeys' || process.versions.electron !== expectedVersion) app.exit(1);
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'passkeys', name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome, phase, checks: [], limitations: [] };
const check = label => { report.checks.push(label); console.log('[Smoke] OK: ' + label); };
let server, window, selection;
const { BrowserPasskeySelection } = require(path.join(sandbox, 'compiled', 'integrated-browser', 'passkey-selection.js'));
void app.whenReady().then(async () => {
  server = http.createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Passkeys de prueba</title>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://localhost:' + server.address().port;
  window = new BrowserWindow({ show: false, opacity: 0, skipTaskbar: true });
  const view = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  window.contentView.addChildView(view); view.setBounds({ x: 0, y: 0, width: 800, height: 600 });
  const contents = view.webContents;
  contents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith(origin + '/') }));
  await contents.loadURL(origin + '/'); window.showInactive();
  assert.equal(await contents.executeJavaScript('typeof PublicKeyCredential === "function" && isSecureContext'), true);
  check('WebAuthn disponible en contexto seguro sin preload ni Node');
  report.windowsPlatformAvailable = await contents.executeJavaScript('PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()');
  assert.equal(typeof report.windowsPlatformAvailable, 'boolean');
  check('consulta nativa de disponibilidad del proveedor sin abrir autenticación');
  const originalDialog = dialog.showMessageBox;
  let response = 1, current = true;
  dialog.showMessageBox = async (_parent, options) => {
    assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0);
    return { response, checkboxChecked: false };
  };
  selection = new BrowserPasskeySelection(contents.session, () => ({ parent: window, contents, assertCurrent: () => { if (!current) throw new Error('Contexto sustituido'); } }));
  const details = { frame: contents.mainFrame, relyingPartyId: 'localhost', accounts: [{ credentialId: 'fixture_1', name: 'Cuenta de prueba' }] };
  let calls = 0;
  const choose = () => new Promise(resolve => contents.session.emit('select-webauthn-account', {}, details, id => { calls++; resolve(id); }));
  assert.equal(await choose(), 'fixture_1'); check('selector real main devuelve sólo la cuenta elegida al callback nativo');
  await new Promise(resolve => setImmediate(resolve)); response = 0;
  assert.equal(await choose(), undefined); check('cancelar selección no devuelve credencial');
  await new Promise(resolve => setImmediate(resolve)); current = false; response = 1;
  assert.equal(await choose(), undefined); assert.equal(calls, 3); check('contexto obsoleto cancela y cada callback se resuelve una sola vez');
  selection.dispose(); selection = null; dialog.showMessageBox = originalDialog;
  contents.debugger.attach('1.3');
  await contents.debugger.sendCommand('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await contents.debugger.sendCommand('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
  } });
  assert.equal(await contents.executeJavaScript(`(async () => {
    const credential = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { id: 'localhost', name: 'Fixture local' },
      user: { id: new Uint8Array([1,2,3,4]), name: 'fixture', displayName: 'Cuenta desechable' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }], timeout: 10000,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, attestation: 'none'
    } });
    window.fixtureCredentialId = credential.rawId;
    return credential.type === 'public-key' && credential.response.attestationObject.byteLength > 0;
  })()`), true);
  check('creación WebAuthn residente en autenticador virtual, sin extraer material privado');
  assert.equal(await contents.executeJavaScript(`(async () => {
    const credential = await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: 'localhost', timeout: 10000,
      allowCredentials: [{ id: window.fixtureCredentialId, type: 'public-key' }], userVerification: 'required'
    } });
    return credential.type === 'public-key' && credential.response.signature.byteLength > 0;
  })()`), true);
  check('autenticación WebAuthn devuelve aserción para el RP original');
  assert.equal(await contents.executeJavaScript(`(async () => {
    try { await navigator.credentials.get({ publicKey: { challenge: new Uint8Array(32), rpId: 'otro.invalid', timeout: 1000 } }); return false; }
    catch (error) { return error.name === 'SecurityError'; }
  })()`), true);
  check('Chromium rechaza RP ajeno antes de autenticar');
  assert.equal(await contents.executeJavaScript(`(async () => {
    const controller = new AbortController(); controller.abort();
    try { await navigator.credentials.get({ signal: controller.signal, publicKey: { challenge: new Uint8Array(32), rpId: 'localhost' } }); return false; }
    catch (error) { return error.name === 'AbortError'; }
  })()`), true);
  check('petición WebAuthn cancelada no se convierte en éxito');
  await contents.debugger.sendCommand('WebAuthn.removeVirtualAuthenticator', { authenticatorId }); contents.debugger.detach();
  report.scope = 'Proveedor Windows sólo consultado; altas/aserciones usan autenticador virtual. Selector usa diálogo con respuesta de fixture, no aceptación humana. No prueba instalador, autofill condicional ni passkeys reales.';
  report.status = 'passed'; window.destroy(); server.close();
  fs.writeFileSync(path.join(sandbox, 'passkeys.json'), JSON.stringify(report, null, 2)); app.exit(0);
}).catch(error => {
  report.status = 'failed'; report.failure = String(error.message).slice(0, 300);
  selection?.dispose(); window?.destroy(); server?.close();
  fs.writeFileSync(path.join(sandbox, 'passkeys.json'), JSON.stringify(report, null, 2)); console.error(report.failure); app.exit(1);
});
