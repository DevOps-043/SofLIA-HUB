import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { _electron } from 'playwright-core';

const require = createRequire(import.meta.url);
const root = process.cwd();
const reports = resolve(process.argv[2] || 'openspec/changes/redesign-project-creation/reports');
const server = await createServer({ configFile: false, root, cacheDir: await mkdtemp(resolve(tmpdir(), 'soflia-creation-vite-')), envDir: resolve(root, 'test/manual/project-creation'), plugins: [react()], optimizeDeps: { entries: ['test/manual/project-creation/index.html'] }, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let app;
try {
  await mkdir(reports, { recursive: true });
  app = await _electron.launch({ executablePath: require('electron'), args: [resolve(root, 'test/manual/project-panel/electron.cjs')], env: { ...process.env, PROJECT_PANEL_PREVIEW_URL: `http://127.0.0.1:${server.httpServer.address().port}/test/manual/project-creation/index.html` } });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const capture = async name => {
    await page.evaluate(() => Promise.race([document.fonts.ready.then(() => undefined), new Promise(resolve => setTimeout(resolve, 1000))]));
    const png = await app.evaluate(async ({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      // La primera captura despierta el compositor de la ventana de QA oculta.
      await contents.capturePage(undefined, { stayHidden: true, stayAwake: true });
      await new Promise(resolve => setTimeout(resolve, 120));
      return (await contents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64');
    });
    await writeFile(resolve(reports, name), Buffer.from(png, 'base64'));
  };
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo proyecto' });
  await dialog.waitFor();
  if (await dialog.getByText(/Organización actual|Nube de Soflia/).count()) throw new Error('Se conservó contenido retirado.');
  if (await dialog.getByRole('combobox').count()) throw new Error('Apareció un selector workspace.');
  if (await dialog.evaluate(node => !!node.closest('aside'))) throw new Error('El diálogo quedó dentro del lateral.');
  await page.getByLabel('Nombre del proyecto').fill('Lanzamiento de producto');
  await dialog.getByRole('button', { name: 'Elegir carpeta' }).click();

  await page.getByRole('button', { name: 'Cambiar', exact: true }).waitFor();
  await dialog.getByRole('button', { name: /Añadir carpeta/ }).click();

  await page.getByRole('button', { name: 'Quitar Referencias' }).waitFor();
  await page.waitForFunction(() => document.querySelector('dialog button[type="submit"]')?.disabled === false);
  await capture('nuevo-proyecto-claro.png');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await capture('nuevo-proyecto-oscuro.png');
  await dialog.getByRole('radio', { name: /Google Drive/ }).click();
  await dialog.getByRole('button', { name: 'Elegir carpeta de nube' }).click();
  await dialog.getByRole('button', { name: /Nueva carpeta/ }).click();
  await dialog.getByLabel('Nombre de la carpeta').fill('Referencias');
  await capture('nuevo-proyecto-nueva-carpeta.png');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Usar esta carpeta' }).click();
  await capture('nuevo-proyecto-drive.png');
  await dialog.getByRole('radio', { name: /OneDrive/ }).click();
  await dialog.getByRole('button', { name: 'Elegir carpeta de nube' }).click();
  await dialog.getByRole('button', { name: 'Usar esta carpeta' }).click();
  await capture('nuevo-proyecto-onedrive.png');
  // Una sola ventana, con el selector y el formulario dentro del mismo diálogo.
  if ((await app.windows()).length !== 1) throw new Error('Se creó una ventana adicional.');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(320, 800));
  await page.waitForFunction(() => window.innerWidth === 320);
  const fits = await dialog.evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight; });
  if (!fits) throw new Error('El diálogo desborda a 320 px.');
  await capture('nuevo-proyecto-compacto.png');
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(1440, 1000); win.webContents.setZoomFactor(2); });
  await page.waitForFunction(() => innerWidth === 720);
  await capture('nuevo-proyecto-zoom.png');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  if (await page.locator(':focus').getAttribute('aria-label') !== 'Crear proyecto') throw new Error('No se restauró el foco al cerrar.');
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByLabel('Nombre del proyecto').fill('Proyecto nube');
  await dialog.getByRole('radio', { name: /Google Drive/ }).click();
  await dialog.getByRole('button', { name: 'Elegir carpeta de nube' }).click();
  await dialog.getByRole('button', { name: 'Usar esta carpeta' }).click();
  await dialog.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Proyecto creado' }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new Event('qa-disconnect')));
  await page.getByRole('button', { name: 'Crear proyecto', exact: true }).click();
  await dialog.getByText('Inicia sesión para continuar').first().waitFor();
  if (!await dialog.getByRole('radio', { name: /Google Drive/ }).isDisabled() || !await dialog.getByRole('radio', { name: /OneDrive/ }).isDisabled()) throw new Error('Proveedor sin cuenta habilitado.');
  await capture('nuevo-proyecto-sin-cuentas.png');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Smoke Electron correcto: selector local nativo mediante bridge doble, carpeta principal/adicional, Google Drive y OneDrive, una ventana, temas claro/oscuro, 320 px, zoom 200 %, Escape, foco y creación. Fixture sin credenciales ni escrituras de negocio.');
} finally { await app?.close(); await server.close(); }
