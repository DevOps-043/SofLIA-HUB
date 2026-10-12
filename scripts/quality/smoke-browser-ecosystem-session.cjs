// Prueba nativa local: no usa cuentas reales ni configuración de producción.
/* global require, console, process */
/* eslint-disable @typescript-eslint/no-require-imports -- Entrada CommonJS del proceso Electron de prueba. */
const { app, session, BrowserWindow } = require('electron');
const http = require('node:http');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

app.whenReady().then(async () => {
  let redirected = false;
  let navigationCookie = '';
  let exchangeCookie = '';
  let window;
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/forbidden' }); res.end(); return; }
    if (req.url === '/forbidden') redirected = true;
    if (req.url === '/page') { navigationCookie = req.headers.cookie || ''; res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<title>Sesión conectada</title>'); return; }
    if (req.url === '/api/auth/hub-session') exchangeCookie = req.headers.cookie || '';
    res.writeHead(200, { 'Set-Cookie': 'ecosystem-smoke=ok; HttpOnly; SameSite=Lax; Path=/', 'Content-Type': 'application/json' });
    res.end('{"success":true}');
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const partition = session.fromPartition(`ecosystem-smoke-${randomUUID()}`);
    const isolated = session.fromPartition(`ecosystem-isolated-${randomUUID()}`);
    const response = await partition.fetch(origin, { method: 'POST', credentials: 'include', redirect: 'error', headers: { Authorization: 'Bearer credencial-ficticia' } });
    assert.equal(response.status, 200);
    assert.equal((await partition.cookies.get({ url: origin }))[0].value, 'ok');
    assert.equal((await isolated.cookies.get({ url: origin })).length, 0);
    await assert.rejects(partition.fetch(`${origin}/redirect`, { redirect: 'error', headers: { Authorization: 'Bearer credencial-ficticia' } }));
    assert.equal(redirected, false);
    const partitionName = `ecosystem-navigation-${randomUUID()}`;
    const browserSession = session.fromPartition(partitionName);
    await browserSession.cookies.set({ url: origin, name: 'existing', value: 'preserved' });
    browserSession.webRequest.onBeforeRequest({ urls: [`${origin}/*`] }, (details, callback) => {
      if (details.resourceType !== 'mainFrame') { callback({}); return; }
      browserSession.fetch(`${origin}/api/auth/hub-session`, { method: 'POST', credentials: 'include', redirect: 'error' })
        .then(response => { assert.equal(response.status, 200); callback({}); })
        .catch(() => callback({ cancel: true }));
    });
    window = new BrowserWindow({ show: false, webPreferences: { partition: partitionName, contextIsolation: true, sandbox: true } });
    await window.loadURL(`${origin}/page`);
    assert.match(exchangeCookie, /existing=preserved/);
    assert.match(navigationCookie, /ecosystem-smoke=ok/);
    console.log('Sesión nativa: intercambio antes de navegar, cookies conservadas, particiones aisladas y redirección rechazada.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { if (window && !window.isDestroyed()) window.destroy(); server.close(); app.exit(process.exitCode || 0); }
});
