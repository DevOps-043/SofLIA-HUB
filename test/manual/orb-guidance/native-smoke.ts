import { app, BrowserWindow, screen } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { GuidanceSurfaces } from '../../../electron/orb-guidance/surfaces';
import { initialGuidanceState } from '../../../src/shared/orb-guidance';
import { intersectRect } from '../../../electron/orb-guidance/geometry';
import { PowerShellWorker } from '../../../electron/desktop-agent/native-worker/powershell-worker';

// Proceso de QA independiente: no importa bootstrap, sesiones ni entorno privado.
const root = path.resolve('work/orb-guidance');
app.setPath('userData', path.join(root, 'native-profile'));
let exitCode = 0;
const watchdog = setTimeout(() => { console.error('La prueba nativa excedió 30 segundos.'); app.exit(1); }, 30_000);

void app.whenReady().then(async () => {
  await fs.mkdir(root, { recursive: true });
  const display = screen.getPrimaryDisplay();
  const stage = new BrowserWindow({ x: display.workArea.x + 60, y: display.workArea.y + 60, width: 640, height: 420, frame: false, show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await stage.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html lang="es"><body style="margin:0;background:#0a2540;color:#fff;font-family:system-ui"><h2 style="padding:24px">Prueba aislada de SofLIA</h2><button style="position:absolute;left:220px;top:180px;width:110px;height:44px">Insertar</button></body></html>'));
  stage.showInactive();
  const orb = new BrowserWindow({ width: 208, height: 340, transparent: true, frame: false, show: false, alwaysOnTop: true, focusable: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  await orb.loadURL('http://127.0.0.1:4321/?native=orb');
  await orb.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const started=Date.now();const check=()=>{if(document.querySelector('.orb-guidance-controls')&&document.querySelector('canvas')){requestAnimationFrame(()=>requestAnimationFrame(resolve));return;}if(Date.now()-started>10000){reject(new Error('El renderer no dibujó la fixture'));return;}setTimeout(check,50);};check();})`);
  const surfaces = new GuidanceSurfaces({ getOrb: () => orb, showOrb: async () => orb.showInactive(), compact: () => undefined });
  try {
    if (process.platform === 'win32') {
      const worker = new PowerShellWorker();
      try {
        const context = await worker.send({ cmd: 'foreground' });
        assert.ok(context.ok && context.cmd === 'foreground');
        if (context.ok && context.cmd === 'foreground') assert.ok(Number.isFinite(context.rect.width));
      } finally { worker.dispose(); }
    }
    const bounds = stage.getContentBounds();
    const rect = { x: bounds.x + 220, y: bounds.y + 180, width: 110, height: 44 };
    await surfaces.render({ ...initialGuidanceState(), phase: 'presenting', target: { point: { x: rect.x + 55, y: rect.y + 22 }, rect } });
    assert.equal(intersectRect(orb.getBounds(), rect), null, 'El orbe cubre el objetivo');
    assert.equal(orb.isFocusable(), false, 'La presentación puede robar foco');
    const overlays = BrowserWindow.getAllWindows().filter(window => window !== stage && window !== orb);
    assert.equal(overlays.length, 1);
    const mark = await overlays[0].webContents.executeJavaScript('({display:getComputedStyle(document.getElementById("mark")).display,style:document.getElementById("mark").dataset.style})');
    assert.equal(mark.display, 'block'); assert.equal(mark.style, 'frame');
    await fs.writeFile(path.join(root, 'native-orb.png'), (await orb.webContents.capturePage()).toPNG());
    const origin = overlays[0].getBounds();
    await fs.writeFile(path.join(root, 'native-mark.png'), (await overlays[0].webContents.capturePage({ x: rect.x - origin.x - 8, y: rect.y - origin.y - 8, width: rect.width + 16, height: rect.height + 16 })).toPNG());
    await surfaces.capture(async () => {
      assert.equal(orb.isVisible(), false);
      assert.ok(overlays.every(window => !window.isVisible()));
      return 'captura limpia';
    });
    assert.equal(orb.isVisible(), true);
    await surfaces.input(async () => 'gesto sin interceptación');
    surfaces.dispose(); assert.ok(overlays.every(window => window.isDestroyed()));
    const report = { success: true, scope: 'Electron real: movimiento, foco, documento de marcas, captura y cierre', screenshots: 2 };
    await fs.writeFile(path.join(root, 'native-result.json'), JSON.stringify(report));
    console.log(JSON.stringify(report));
  } finally { surfaces.dispose(); stage.close(); orb.close(); }
}).catch(async error => { exitCode = 1; console.error(error); await fs.writeFile(path.join(root, 'native-result.json'), JSON.stringify({ success: false, error: String(error) })); }).finally(() => { clearTimeout(watchdog); app.exit(exitCode); });
