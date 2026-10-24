const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');
const [sandbox, expectedVersion] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-app-build-') || process.versions.electron !== expectedVersion) {
  app.exit(1);
  throw new Error('Parámetros de prueba inválidos.');
}
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'select-profile', name);
  fs.mkdirSync(directory, { recursive: true });
  app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  checks: [], scope: 'Control real local, teclado y AX; no lector de pantalla ni certificación global.' };
const write = () => fs.writeFileSync(path.join(sandbox, 'select-dropdown.json'), JSON.stringify(report, null, 2) + '\n');
function fail(error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : 'Fallo de prueba';
  write();
  console.error('[Selector] Falló:', report.error);
  app.exit(1);
}
function check(message) { report.checks.push(message); console.log('[Selector] OK:', message); }
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
setTimeout(() => fail(new Error('El smoke nativo superó 45 segundos.')), 45_000).unref();

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|wss?):/i.test(details.url) }));
  const window = new BrowserWindow({ show: false, width: 900, height: 650,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const contents = window.webContents;
  const evaluate = code => contents.executeJavaScript(code);
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => resolve(true)))');
  const press = async keyCode => {
    contents.sendInputEvent({ type: 'keyDown', keyCode });
    contents.sendInputEvent({ type: 'keyUp', keyCode });
    await settle();
  };
  const focus = () => evaluate('document.getElementById("device").focus()');
  await window.loadFile(path.join(sandbox, 'select-dropdown-dist/index.html'));
  for (let attempt = 0; attempt < 100 && !await evaluate('Boolean(window.selectSmoke)'); attempt++) await settle();
  assert.equal(await evaluate('Boolean(window.selectSmoke)'), true);
  contents.debugger.attach('1.3');
  await contents.debugger.sendCommand('Accessibility.enable');
  // La ventana permanece oculta: emular foco de documento permite eventos
  // nativos focusin/focusout sin tomar el foco del escritorio del usuario.
  await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
  await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  report.focusEmulated = true;
  await focus();
  await press('Down');
  assert.equal(await evaluate('Boolean(document.querySelector("dialog[open] [role=listbox]"))'), true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[role=listbox]")).transitionProperty'), 'none');
  const tree = await contents.debugger.sendCommand('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(node => node.role?.value === 'combobox' && node.name?.value === 'Dispositivo de prueba'
    && node.properties?.some(property => property.name === 'expanded' && property.value.value === true)));
  check('el árbol AX conserva nombre externo y estado expandido en portal modal real');
  await press('Escape');
  assert.equal(await evaluate('document.querySelector("dialog").open && !document.querySelector("[role=listbox]")'), true);
  assert.equal(await evaluate('document.activeElement.id'), 'device');
  await press('Escape');
  assert.equal(await evaluate('document.querySelector("dialog").open'), false);
  check('primer Escape cierra sólo popup; segundo Escape puede cerrar el diálogo nativo');
  await evaluate('window.selectSmoke.open()');
  await focus();
  await press('Down');
  await press('Down');
  await evaluate('window.selectSmoke.reorder()');
  await settle();
  await press('Enter');
  assert.equal(await evaluate('document.getElementById("changes").textContent'), 'headphones');
  check('reordenar opciones conserva la identidad elegida sin cambiar el foco');
  await press('Down');
  await press('Tab');
  assert.equal(await evaluate('document.activeElement.id'), 'after');
  assert.equal(await evaluate('Boolean(document.querySelector("[role=listbox]"))'), false, 'Tab debe cerrar la lista');
  assert.equal(await evaluate('document.getElementById("changes").textContent'), 'headphones');
  await focus();
  await press('Down');
  await evaluate(`window.focusTrace = [];
    for (const type of ['focusin', 'focusout']) document.addEventListener(type, event =>
      window.focusTrace.push({ type, target: event.target.id, related: event.relatedTarget?.id }));`);
  await evaluate('document.getElementById("after").focus()');
  await settle();
  report.focus = await evaluate('({ focused: document.hasFocus(), active: document.activeElement.id, trace: window.focusTrace })');
  assert.equal(report.focus.focused, true);
  assert.ok(report.focus.trace.some(event => event.type === 'focusout' && event.target === 'device'));
  assert.equal(await evaluate('Boolean(document.querySelector("[role=listbox]"))'), false, 'El cambio de foco debe cerrar la lista');
  check('Tab y cambio de foco cierran sin confirmar ni atrapar al usuario');
  await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  contents.setZoomFactor(2);
  window.setContentSize(720, 400);
  await evaluate('window.selectSmoke.many()');
  await settle();
  await focus();
  await press('Down');
  await press('End');
  const layout = await evaluate(`(() => {
    const menu = document.querySelector('[role=listbox]');
    const trigger = document.getElementById('device');
    const active = document.getElementById(trigger.getAttribute('aria-activedescendant'));
    const bounds = menu.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom, right: bounds.right, width: innerWidth, height: innerHeight,
      scrollTop: menu.scrollTop, activeTop: item.top, activeBottom: item.bottom,
      activeVisible: item.top >= bounds.top && item.bottom <= bounds.bottom,
      animation: getComputedStyle(menu).animationName, transitionProperty: getComputedStyle(trigger.querySelector('svg')).transitionProperty };
  })()`);
  assert.ok(layout.top >= 0 && layout.bottom <= layout.height && layout.right <= layout.width, JSON.stringify(layout));
  assert.ok(layout.scrollTop > 0 && layout.activeVisible, JSON.stringify(layout));
  assert.equal(layout.animation, 'none');
  assert.equal(layout.transitionProperty, 'none');
  report.zoom = { factor: contents.getZoomFactor(), ...layout };
  fs.writeFileSync(path.join(sandbox, 'select-dropdown-200.png'), (await contents.capturePage()).toPNG());
  check('a 200% la lista queda en viewport y End muestra la opción final con movimiento reducido');
  await evaluate('document.querySelector("[role=listbox]").scrollTop = 0');
  await settle();
  await settle();
  assert.equal(await evaluate('document.querySelector("[role=listbox]").scrollTop'), 0);
  check('desplazar opciones no fuerza el retorno a la opción activa');
  report.status = 'passed';
  write();
  contents.debugger.detach();
  window.destroy();
  app.exit(0);
}).catch(fail);
