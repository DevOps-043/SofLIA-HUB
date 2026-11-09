const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');
const [sandbox, expectedVersion] = process.argv.slice(2);
if (!path.isAbsolute(sandbox || '') || !path.basename(sandbox).startsWith('pulse-app-build-') || process.versions.electron !== expectedVersion) {
  app.exit(1); throw new Error('Parámetros de prueba inválidos.');
}
for (const name of ['userData', 'sessionData', 'logs', 'crashDumps', 'temp']) {
  const directory = path.join(sandbox, 'confirmation-profile', name); fs.mkdirSync(directory, { recursive: true }); app.setPath(name, directory);
}
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const report = { status: 'running', electron: process.versions.electron, chromium: process.versions.chrome,
  checks: [], artifacts: [], layouts: [], scope: 'Componente local real, teclado y AX con foco emulado; no lector de pantalla ni certificación global.' };
let window;
const write = () => fs.writeFileSync(path.join(sandbox, 'confirmation-dialog.json'), JSON.stringify(report, null, 2) + '\n');
function fail(error) {
  if (report.status === 'failed') return;
  report.status = 'failed'; report.error = error instanceof Error ? error.message.slice(0, 300) : 'Fallo de prueba'; write();
  if (window && !window.isDestroyed()) window.destroy(); console.error('[Confirmación] Falló: ' + report.error); app.exit(1);
}
const check = text => { report.checks.push(text); console.log('[Confirmación] OK: ' + text); };
process.on('uncaughtException', fail); process.on('unhandledRejection', fail);
setTimeout(() => fail(new Error('El smoke de confirmación superó 45 segundos.')), 45_000).unref();
void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|wss?):/i.test(details.url) }));
  window = new BrowserWindow({ show: false, width: 960, height: 720,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const contents = window.webContents;
  const evaluate = code => contents.executeJavaScript(code);
  // El flujo DOM no depende de frames programados en una ventana oculta.
  const settle = () => evaluate('new Promise(resolve => setTimeout(() => resolve(document.body.getBoundingClientRect().width), 0))');
  const press = async (keyCode, modifiers = []) => {
    const before = await evaluate('({ tag:document.activeElement.tagName,text:document.activeElement.textContent.trim().slice(0,80) })');
    contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    if (keyCode === 'Enter' || keyCode === 'Space') contents.sendInputEvent({ type: 'char', keyCode, modifiers });
    contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers }); await settle();
    (report.keyTrace ??= []).push({ keyCode,modifiers,before,after:await evaluate('({ tag:document.activeElement.tagName,text:document.activeElement.textContent.trim().slice(0,80) })') });
  };
  const active = () => evaluate('document.activeElement.textContent.trim()');
  const open = async (long = false, always = true, toolName = 'execute_command') => {
    await evaluate(`document.getElementById('open').focus(); window.confirmationSmoke.open(${long}, ${always}, '${toolName}')`); await settle();
  };
  const decide = () => evaluate("document.getElementById('decisions').textContent");
  const mouse = async (type, x, y) => {
    contents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }); await settle();
  };
  const firstPaint = new Promise(resolve => window.once('ready-to-show', resolve));
  await window.loadFile(path.join(sandbox, 'confirmation-dialog-dist/index.html')); await firstPaint;
  report.interactionRendering = 'window-hidden';
  for (let attempt = 0; attempt < 100 && !await evaluate('Boolean(window.confirmationSmoke)'); attempt++) await settle();
  assert.equal(await evaluate('Boolean(window.confirmationSmoke)'), true);
  contents.debugger.attach('1.3'); await contents.debugger.sendCommand('Accessibility.enable');
  await contents.debugger.sendCommand('DOM.enable'); await contents.debugger.sendCommand('CSS.enable');
  await contents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true }); report.focusEmulated = true;
  await evaluate(`window.confirmationCloseTrace = []; const nativeClose = HTMLDialogElement.prototype.close;
    HTMLDialogElement.prototype.close = function(...args) { window.confirmationCloseTrace.push({ connected:this.isConnected, before:document.activeElement.id }); return nativeClose.apply(this,args); }; true;`);
  await open(); report.initialFocus = await active(); assert.equal(report.initialFocus, 'Cancelar');
  await evaluate("document.getElementById('background').focus()"); assert.equal(await active(), 'Cancelar');
  const tree = await contents.debugger.sendCommand('Accessibility.getFullAXTree');
  assert.ok(tree.nodes.some(node => !node.ignored && node.role?.value === 'dialog' && /SofLIA quiere/.test(node.name?.value ?? '')
    && node.properties?.some(property => property.name === 'modal' && property.value.value === true)));
  assert.equal(tree.nodes.some(node => !node.ignored && node.role?.value === 'button' && node.name?.value === 'Acción de fondo'), false);
  check('modalidad nativa: Cancelar recibe foco y el fondo queda fuera de foco y árbol AX operativo');
  await press('Tab'); assert.equal(await active(), 'Siempre permitir');
  await press('Tab'); assert.equal(await active(), 'Ejecutar');
  await press('Tab'); assert.equal(await active(), 'Cancelar');
  await press('Tab', ['shift']); assert.equal(await active(), 'Ejecutar');
  assert.equal(await evaluate("document.getElementById('shortcuts').textContent"), '0');
  check('Tab y Shift+Tab recorren acciones del modal sin shortcuts por burbujeo');
  await evaluate('window.confirmationSmoke.replace()'); await settle(); assert.equal(await active(), 'Cancelar');
  check('otra solicitud con texto idéntico renueva foco seguro');
  await press('Escape'); assert.equal(await decide(), 'cancelar');
  report.restoration = await evaluate('({ active:document.activeElement.id, trace:window.confirmationCloseTrace })');
  assert.equal(await evaluate("document.activeElement.id"), 'open'); assert.equal(await evaluate('Boolean(document.querySelector("dialog[open]"))'), false);
  check('Escape cancela sin aprobar y devuelve foco al invocador');

  report.decisionTrace = [];
  for (const key of ['Enter', 'Space']) for (const [index, decision] of [[0, 'cancelar'], [1, 'siempre'], [2, 'confirmar']]) {
    await open(); for (let step = 0; step < index; step++) await press('Tab');
    const before = await decide(), focused = await active(); await press(key);
    const after = await decide(), opened = await evaluate('Boolean(document.querySelector("dialog[open]"))');
    report.decisionTrace.push({ key, decision, focused, before, after, opened });
    assert.equal(after, before + ',' + decision); assert.equal(await evaluate("document.getElementById('submitted').textContent"), '0');
    assert.equal(opened, false);
  }
  check('las tres decisiones explícitas mantienen su resultado sin enviar formulario exterior');
  await open(false, false); await press('Tab'); assert.equal(await active(), 'Ejecutar');
  assert.equal(await evaluate('Array.from(document.querySelectorAll("dialog button")).some(button => button.textContent === "Siempre permitir")'), false);
  await evaluate('window.confirmationSmoke.close()'); await settle(); assert.equal(await evaluate('document.activeElement.id'), 'open');
  check('sin permiso permanente sólo se ofrecen Cancelar y Ejecutar; cierre controlado restaura foco');

  await open(); const beforeDrag = await decide();
  const point = await evaluate('(() => { const r = document.querySelector("dialog h3").getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 }; })()');
  await mouse('mouseDown', point.x, point.y); await mouse('mouseMove', 5, 5); await mouse('mouseUp', 5, 5);
  assert.equal(await decide(), beforeDrag); assert.equal(await evaluate('Boolean(document.querySelector("dialog[open]"))'), true);
  await mouse('mouseDown', 5, 5); await mouse('mouseUp', 5, 5);
  assert.ok((await decide()).endsWith('cancelar')); assert.equal(await evaluate('Boolean(document.querySelector("dialog[open]"))'), false);
  check('arrastrar desde contenido no decide; clic real en fondo sólo cancela');

  await open(); const beforeReplacement = await decide();
  const confirmPoint = await evaluate('(() => { const buttons = document.querySelectorAll("dialog button"); const r = buttons[buttons.length-1].getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 }; })()');
  await mouse('mouseDown', confirmPoint.x, confirmPoint.y);
  await evaluate('window.confirmationSmoke.replace()'); await settle();
  await mouse('mouseUp', confirmPoint.x, confirmPoint.y);
  report.replacementGesture = { before:beforeReplacement, after:await decide(), opened:await evaluate('Boolean(document.querySelector("dialog[open]"))') };
  assert.equal(report.replacementGesture.after, beforeReplacement); assert.equal(report.replacementGesture.opened, true);
  await press('Tab'); await press('Tab'); assert.equal(await active(), 'Ejecutar');
  contents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' }); contents.sendInputEvent({ type: 'char', keyCode: 'Space' }); await settle();
  await evaluate('window.confirmationSmoke.replace()'); await settle();
  contents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' }); await settle();
  report.replacementKeyboard = { before:beforeReplacement, after:await decide(), opened:await evaluate('Boolean(document.querySelector("dialog[open]"))') };
  assert.equal(report.replacementKeyboard.after, beforeReplacement); assert.equal(report.replacementKeyboard.opened, true);
  await press('Escape');
  check('un gesto de aprobación de ratón o Space iniciado antes de reemplazar la solicitud no decide la nueva');

  await contents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  report.contrast = [];
  for (const theme of ['dark', 'light']) for (const toolName of ['execute_command', 'send_email', 'delete_item']) {
    report.stage = 'contraste:' + theme + ':' + toolName;
    await evaluate(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`); await open(false, false, toolName);
    await mouse('mouseMove', 1, 1);
    const documentNode = await contents.debugger.sendCommand('DOM.getDocument');
    const buttonNode = await contents.debugger.sendCommand('DOM.querySelector', { nodeId:documentNode.root.nodeId, selector:'dialog[open] button:last-of-type' });
    assert.ok(buttonNode.nodeId > 0);
    for (const state of ['default', 'hover']) {
      await contents.debugger.sendCommand('CSS.forcePseudoState', { nodeId:buttonNode.nodeId, forcedPseudoClasses:state === 'hover' ? ['hover'] : [] });
      const colors = await evaluate(`(() => {
        const buttons = document.querySelectorAll('dialog button'), style = getComputedStyle(buttons[buttons.length-1]);
        const canvas = document.createElement('canvas'); canvas.width=canvas.height=1; const ctx=canvas.getContext('2d');
        const rgba = color => { ctx.clearRect(0,0,1,1); ctx.fillStyle=color; ctx.fillRect(0,0,1,1); return Array.from(ctx.getImageData(0,0,1,1).data); };
        return { foreground:rgba(style.color), background:rgba(style.backgroundColor) };
      })()`);
      assert.equal(colors.foreground[3], 255); assert.equal(colors.background[3], 255);
      const luminance = rgba => rgba.slice(0,3).map(value => value/255).map(value => value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4)
        .reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0);
      const first=luminance(colors.foreground), second=luminance(colors.background);
      report.contrast.push({ theme,toolName,state,hoverForced:state === 'hover',...colors,ratio:(Math.max(first,second)+0.05)/(Math.min(first,second)+0.05) });
    }
    await contents.debugger.sendCommand('CSS.forcePseudoState', { nodeId:buttonNode.nodeId, forcedPseudoClasses:[] });
    assert.notDeepEqual(report.contrast.at(-1).background, report.contrast.at(-2).background);
    await evaluate('window.confirmationSmoke.close()'); await settle();
  }
  assert.ok(report.contrast.every(result => result.ratio >= 4.5), JSON.stringify(report.contrast));
  check('las tres variantes conservan contraste 4.5:1 de texto principal en ambos temas, reposo y hover');
  contents.setZoomFactor(2); window.setContentSize(720, 400);
  for (const theme of ['dark', 'light']) {
    report.stage = 'tema-200:' + theme;
    await evaluate(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`); await open(true);
    assert.equal(await evaluate('document.activeElement.tagName'), 'H3');
    const layout = await evaluate(`(() => {
      const card = document.querySelector('dialog h3').closest('div.relative'), r = card.getBoundingClientRect();
      return { top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight,scrollTop:card.scrollTop,
        animation:getComputedStyle(card).animationName, transition:getComputedStyle(document.querySelector('dialog button')).transitionProperty };
    })()`);
    assert.ok(layout.top >= 0 && layout.bottom <= layout.height && layout.left >= 0 && layout.right <= layout.width, JSON.stringify(layout));
    assert.equal(layout.scrollTop, 0); assert.equal(layout.animation, 'none'); assert.equal(layout.transition, 'none');
    await press('Tab'); assert.equal(await active(), 'Cancelar');
    const visible = await evaluate(`(() => { const b=document.activeElement.getBoundingClientRect(); const card=document.querySelector('dialog h3').closest('div.relative'); const r=card.getBoundingClientRect(); return { visible:b.top>=r.top && b.bottom<=r.bottom, scroll:card.scrollTop }; })()`);
    assert.ok(visible.visible && visible.scroll > 0); report.layouts.push({ theme, factor: contents.getZoomFactor(), ...layout, action: visible });
    await press('Escape');
  }
  check('ambos temas a 200% conservan lectura inicial y acciones desplazables con movimiento reducido');
  report.status = 'passed'; write(); contents.debugger.detach(); window.destroy(); app.exit(0);
}).catch(fail);

