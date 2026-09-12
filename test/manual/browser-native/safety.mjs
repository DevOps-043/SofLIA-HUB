import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
import { createRequire } from 'node:module';
import { app, BrowserWindow, session } from 'electron';
const loadCompiled = createRequire(import.meta.url);
const [sandbox, expectedVersion, phase] = process.argv.slice(2);
if (!sandbox || !path.isAbsolute(sandbox) || !path.basename(sandbox).startsWith('pulse-browser-smoke-') || phase !== 'safety' || process.versions.electron !== expectedVersion) {
  console.error('[Smoke] Parámetros o runtime de seguridad inválidos.'); app.exit(1);
}
for (const name of ['userData', 'sessionData', 'downloads', 'logs', 'crashDumps']) {
  const directory = path.join(sandbox, name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP *.example.com 127.0.0.1');
const { BrowserRequestSafety } = loadCompiled(path.join(sandbox, 'compiled/integrated-browser/request-safety.js'));
const { BrowserSafetyInterstitials } = loadCompiled(path.join(sandbox, 'compiled/integrated-browser/safety-interstitial.js'));
const { browserCertificateDecision } = loadCompiled(path.join(sandbox, 'compiled/integrated-browser/certificate-policy.js'));
const report = { status: 'running', electron: process.versions.electron, phase, checks: [], limitations: [] };
const traffic = [], queries = []; let downloads = 0; let server; let window; let tlsServer; let popup;
const policy = new Set(['blocked.example.com']);
function record(label) { report.checks.push(label); console.log(`[Smoke] OK: ${label}`); }
function finish(error) {
  report.status = error ? 'failed' : 'passed';
  if (error) { report.error = error instanceof Error ? error.message : 'Fallo nativo'; console.error('[Smoke] Falló:', report.error); }
  fs.writeFileSync(path.join(sandbox, 'safety.json'), JSON.stringify(report, null, 2));
  server?.closeAllConnections(); server?.close(); tlsServer?.closeAllConnections(); tlsServer?.close();
  if (popup && !popup.isDestroyed()) popup.destroy();
  if (window && !window.isDestroyed()) window.destroy(); app.exit(error ? 1 : 0);
}
process.on('uncaughtException', finish); process.on('unhandledRejection', finish);
setTimeout(() => finish(new Error('El smoke de seguridad excedió 45 segundos.')), 45_000).unref();
app.whenReady().then(async () => {
  let port;
  server = http.createServer((req, res) => {
    if (req.url === '/verdict') {
      let body = ''; req.on('data', (chunk) => { body += chunk; }); req.on('end', () => {
        const input = JSON.parse(body); queries.push(input);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ action: policy.has(input.hostname) ? 'block' : 'allow' }));
      }); return;
    }
    traffic.push({ host: req.headers.host, url: req.url });
    if (req.url === '/redirect') { res.writeHead(302, { Location: `http://blocked.example.com:${port}/redireccion` }); res.end(); return; }
    if (req.url === '/download') {
      // El dominio cambia de reputación entre la autorización inicial y las cabeceras.
      policy.add('files.example.com'); res.writeHead(200, { 'Content-Disposition': 'attachment; filename="prueba.txt"', 'Content-Type': 'application/octet-stream' }); res.end('Sólo prueba local'); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/frame'
      ? `<!doctype html><iframe src="http://blocked.example.com:${port}/frame-denied"></iframe>`
      : '<!doctype html><title>Prueba local</title><p>Contenido de prueba</p>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
  process.env.BROWSER_SAFE_BROWSING_ENDPOINT = `http://127.0.0.1:${port}/verdict`;
  const partition = session.fromPartition('safety-fixture'); const safety = new BrowserRequestSafety();
  window = new BrowserWindow({ show: false, webPreferences: { session: partition, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  const contents = window.webContents; const filter = { urls: ['http://*.example.com/*'] };
  partition.webRequest.onBeforeRequest(filter, (details, callback) => {
    if (!['mainFrame', 'subFrame', 'other'].includes(details.resourceType)) { callback({}); return; }
    const target = details.webContents;
    assert.ok(target === contents || target === popup?.webContents);
    const frame = details.resourceType === 'subFrame' ? 'child' : 'main';
    safety.invalidate(target, frame);
    void safety.review(details.url, target, frame, () => !target.isDestroyed()).then((verdict) => callback({ cancel: !verdict || verdict.action === 'block' }));
  });
  partition.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (!Object.keys(details.responseHeaders).some((key) => key.toLowerCase() === 'content-disposition')) { callback({}); return; }
    void safety.review(details.url, contents, 'download', () => !contents.isDestroyed()).then((verdict) => callback({ cancel: !verdict || verdict.action === 'block' }));
  });
  partition.on('will-download', (event) => { downloads++; event.preventDefault(); });
  await contents.loadURL(`http://allowed.example.com:${port}/inicio?privado=solo-local`);
  assert.ok(traffic.some((request) => request.url.includes('/inicio'))); record('Navegación permitida después de consultar el proveedor local.');
  await assert.rejects(contents.loadURL(`http://blocked.example.com:${port}/bloqueado`));
  assert.ok(!traffic.some((request) => request.host.startsWith('blocked.example.com'))); record('Bloqueo remoto antes de enviar la solicitud al destino.');
  await assert.rejects(contents.loadURL(`http://allowed.example.com:${port}/redirect`));
  assert.ok(!traffic.some((request) => request.host.startsWith('blocked.example.com'))); record('La redirección no evita la revisión de solicitudes.');
  await assert.rejects(contents.loadURL(`http://files.example.com:${port}/download`));
  assert.equal(downloads, 0); record('Revisión de adjunto en cabeceras antes de will-download.');
  const directUrl = `http://blocked.example.com:${port}/direct-download`;
  const failedDownload = new Promise((resolve) => partition.webRequest.onErrorOccurred(filter, (details) => { if (details.url === directUrl) resolve(); }));
  contents.downloadURL(directUrl); await failedDownload;
  assert.equal(downloads, 0); assert.ok(!traffic.some((request) => request.host.startsWith('blocked.example.com')));
  record('La descarga directa también pasa por la revisión remota antes de contactar el destino.');
  await contents.loadURL(`http://allowed.example.com:${port}/frame`);
  assert.ok(!traffic.some((request) => request.url === '/frame-denied'));
  record('Marco secundario real bloqueado sin enviar contenido al destino.');
  popup = new BrowserWindow({ parent: window, show: false, webPreferences: { session: partition, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await assert.rejects(popup.webContents.loadURL(`http://blocked.example.com:${port}/popup-denied`));
  assert.ok(!traffic.some((request) => request.url === '/popup-denied'));
  record('Ventana hija con la sesión compartida conserva la revisión remota.');
  // Certificado ficticio efímero; nunca se agrega a almacenes de confianza.
  const openssl = path.join(process.env.ProgramFiles ?? 'C:/Program Files', 'Git/usr/bin/openssl.exe');
  assert.ok(fs.existsSync(openssl), 'La fase TLS necesita OpenSSL de Git para Windows.');
  const keyFile = path.join(sandbox, 'fixture-key.pem'), certFile = path.join(sandbox, 'fixture-cert.pem');
  const generated = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost'], { windowsHide: true, timeout: 10_000, encoding: 'utf8' });
  assert.equal(generated.status, 0, 'No se pudo crear el certificado de prueba.');
  let certificateRejected = false; let servedTls = false;
  tlsServer = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (_req, res) => { servedTls = true; res.end('Nunca aceptar'); });
  await new Promise((resolve) => tlsServer.listen(0, '127.0.0.1', resolve));
  partition.setCertificateVerifyProc((request, callback) => {
    const decision = browserCertificateDecision(request.verificationResult);
    certificateRejected ||= decision === -2; callback(decision);
  });
  await assert.rejects(contents.loadURL(`https://127.0.0.1:${tlsServer.address().port}/`));
  assert.equal(certificateRejected, true); assert.equal(servedTls, false);
  record('Certificado autofirmado real rechazado por la política del producto sin bypass TLS.');
  assert.ok(queries.length >= 6);
  assert.ok(queries.every((query) => Object.keys(query).sort().join(',') === 'hostname,port,protocol'));
  assert.ok(!JSON.stringify(queries).includes('solo-local')); record('No se envían rutas, consultas ni fragmentos al proveedor.');
  const interstitials = new BrowserSafetyInterstitials(); let blankActions = 0; let closeActions = 0;
  interstitials.show('fixture', { parent: window, bounds: { x: 0, y: 0, width: 640, height: 480 }, verdict: { action: 'block', source: 'remote', reason: '<script>intrusión</script>', checkedAt: new Date().toISOString() },
    isCurrent: () => !window.isDestroyed(), openBlank: async () => { blankActions++; }, close: () => { closeActions++; interstitials.remove('fixture'); } });
  const overlay = window.contentView.children[window.contentView.children.length - 1];
  await new Promise((resolve, reject) => { overlay.webContents.once('did-finish-load', resolve); overlay.webContents.once('did-fail-load', () => reject(new Error('No cargó el intersticial nativo.'))); });
  assert.notEqual(overlay.webContents.session, contents.session);
  assert.equal(overlay.webContents.getLastWebPreferences().nodeIntegration, false);
  assert.equal(overlay.webContents.getLastWebPreferences().javascript, false);
  overlay.webContents.debugger.attach('1.3');
  const { root: document } = await overlay.webContents.debugger.sendCommand('DOM.getDocument', { depth: -1 });
  const nodes = []; const collect = (node) => { nodes.push(node); for (const child of node.children ?? []) collect(child); }; collect(document);
  assert.ok(!nodes.some((node) => node.nodeName === 'SCRIPT')); assert.ok(nodes.some((node) => node.nodeValue === '<script>intrusión</script>'));
  const links = nodes.filter((node) => node.nodeName === 'A');
  assert.deepEqual(links.map((node) => node.attributes[node.attributes.indexOf('href') + 1]), ['https://browser-safety.invalid/blank', 'https://browser-safety.invalid/close']);
  record('Intersticial nativo aislado, sin scripts ni enlace para omitir el bloqueo.');
  const { model } = await overlay.webContents.debugger.sendCommand('DOM.getBoxModel', { nodeId: links[0].nodeId });
  const x = (model.content[0] + model.content[2]) / 2, y = (model.content[1] + model.content[5]) / 2;
  await overlay.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await overlay.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  const deadline = Date.now() + 3_000;
  while (blankActions === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(blankActions, 1); record('La acción de página en blanco llega a main sin navegar ni exponer IPC.');
  const overlayContents = overlay.webContents;
  assert.ok(overlayContents.getURL().startsWith('data:text/html'));
  const { model: closeModel } = await overlayContents.debugger.sendCommand('DOM.getBoxModel', { nodeId: links[1].nodeId });
  const closeX = (closeModel.content[0] + closeModel.content[2]) / 2, closeY = (closeModel.content[1] + closeModel.content[5]) / 2;
  const destroyed = new Promise((resolve) => overlayContents.once('destroyed', resolve));
  await overlayContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: closeX, y: closeY, button: 'left', clickCount: 1 });
  await overlayContents.debugger.sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: closeX, y: closeY, button: 'left', clickCount: 1 }).catch((error) => { if (!overlayContents.isDestroyed()) throw error; });
  await destroyed; assert.equal(closeActions, 1); assert.equal(overlayContents.isDestroyed(), true); interstitials.clear();
  record('El botón Cerrar llega a main y libera su webContents nativo sin navegación externa.');
  safety.cancelAll(); finish();
}).catch(finish);
