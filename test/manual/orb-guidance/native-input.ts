import { app, BrowserWindow, screen } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DesktopMouseControls } from '../../../electron/desktop-agent/mouse-controls';
import { DesktopKeyboardControls } from '../../../electron/desktop-agent/keyboard-controls';
import { runPowerShellInput } from '../../../electron/desktop-agent/powershell-input';
import { createInputDriver } from '../../../electron/desktop-agent/input-driver';
import { dipToScreenPoint } from '../../../electron/desktop-agent/screenshot-coordinates';

const output = path.resolve('work/native-input');
app.setPath('userData', path.join(output, 'profile'));
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const timeout = setTimeout(() => app.exit(1), 25000);
let code = 0;
void app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true });
  const area = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({ x: area.x + 80, y: area.y + 100, width: 620, height: 380, frame: false, alwaysOnTop: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html lang="es"><body style="font:18px system-ui;padding:24px"><h2>Prueba física aislada de SofLIA</h2><button id="target" style="position:absolute;left:180px;top:120px;width:200px;height:48px" onclick="window.clicked=(window.clicked||0)+1;window.trusted=event.isTrusted;this.textContent='Clic recibido'">Haz clic aquí</button><input id="entry" style="position:absolute;left:180px;top:220px;width:280px;height:48px" aria-label="Campo de prueba"></body></html>`));
    win.show(); win.focus(); await delay(200);
    const mouse = new DesktopMouseControls(runPowerShellInput, (x, y) => ({ x, y }), delay);
    const keyboard = new DesktopKeyboardControls(runPowerShellInput, delay);
    const driver = createInputDriver({ backend: 'nut', mouse, keyboard });
    if (driver.capacidades().backend === 'nut') { mouse.setInputDriver(driver); keyboard.setInputDriver(driver); }
    const origin = win.getContentBounds();
    const button = dipToScreenPoint({ x: origin.x + 270, y: origin.y + 144 });
    await mouse.clickAtPhysicalPoint(button.x, button.y); await delay(120);
    assert.equal(await win.webContents.executeJavaScript('window.clicked'), 1);
    assert.equal(await win.webContents.executeJavaScript('window.trusted'), true);
    const entry = dipToScreenPoint({ x: origin.x + 280, y: origin.y + 244 });
    await mouse.clickAtPhysicalPoint(entry.x, entry.y);
    await keyboard.keyboardType('Prueba del orbe'); await delay(200);
    assert.equal(await win.webContents.executeJavaScript('document.getElementById("entry").value'), 'Prueba del orbe');
    mouse.setInputDriver(null); keyboard.setInputDriver(null);
    await mouse.clickAtPhysicalPoint(button.x, button.y); await delay(120);
    assert.equal(await win.webContents.executeJavaScript('window.clicked'), 2);
    await mouse.clickAtPhysicalPoint(entry.x, entry.y);
    await keyboard.keyboardKey('ctrl+a'); await keyboard.keyboardType('Prueba fallback'); await delay(200);
    assert.equal(await win.webContents.executeJavaScript('document.getElementById("entry").value'), 'Prueba fallback');
    if (process.platform === 'win32') {
      await assert.rejects(runPowerShellInput('[void][SofliaTipoInexistente]::NoOp()'));
    }
    await fs.writeFile(path.join(output, 'input.png'), (await win.webContents.capturePage()).toPNG());
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ success: true, backend: driver.capacidades().backend, physicalClick: true, trustedEvent: true, text: true, fallbackClick: true, fallbackText: true, silentErrorsRejected: true }));
  } finally { win.destroy(); }
}).catch(async error => { code = 1; await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ success: false, error: String(error) })); }).finally(() => { clearTimeout(timeout); app.exit(code); });
