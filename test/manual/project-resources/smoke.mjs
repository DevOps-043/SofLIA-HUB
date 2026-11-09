import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { _electron } from 'playwright-core';
const require = createRequire(import.meta.url), root = process.cwd(), reports = resolve(process.argv[2] || 'openspec/changes/unify-project-resources-and-chats/reports');
const server = await createServer({ configFile: false, root, cacheDir: await mkdtemp(resolve(tmpdir(), 'soflia-resources-qa-')), envDir: resolve(root, 'test/manual/project-resources'), plugins: [react()], optimizeDeps: { entries: ['test/manual/project-resources/index.html'] }, server: { host: '127.0.0.1', port: 0 } });
await server.listen(); let app;
try {
 await mkdir(reports, { recursive: true });
 app = await _electron.launch({ executablePath: require('electron'), args: [resolve(root, 'test/manual/project-panel/electron.cjs')], env: { ...process.env, PROJECT_PANEL_PREVIEW_URL: `http://127.0.0.1:${server.httpServer.address().port}/test/manual/project-resources/index.html` } });
 const page = await app.firstWindow(); page.setDefaultTimeout(15000); const errors = []; page.on('pageerror', error => errors.push(error.message));
 const capture = async name => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))));
  const png = await app.evaluate(async ({ BrowserWindow }) => { const view = BrowserWindow.getAllWindows()[0].webContents; await view.capturePage(undefined, { stayHidden: true, stayAwake: true }); await new Promise(resolve => setTimeout(resolve, 120)); return (await view.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'); });
  await writeFile(resolve(reports, name), Buffer.from(png, 'base64'));
 };
 await page.getByRole('button', { name: 'Vista previa de Notas del proyecto.md', exact: true }).waitFor();
 if (await page.getByRole('button', { name: 'Añadir colaborador', exact: true }).count() || await page.getByRole('button', { name: 'Añadir tarea', exact: true }).count()) throw new Error('Persisten las acciones superiores.');
 if (await page.getByRole('textbox').count() !== 2) throw new Error('Archivos debe tener sólo la búsqueda del lateral y Buscar archivos.');
 await capture('proyecto-archivos-claro.png'); await page.evaluate(() => document.documentElement.classList.add('dark')); await capture('proyecto-archivos-oscuro.png');
 await page.getByRole('button', { name: 'Vista previa de Notas del proyecto.md', exact: true }).click(); await page.getByText(/Simplificar el trabajo/).waitFor(); await capture('proyecto-archivo-vista-previa.png'); await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
 await page.getByRole('button', { name: 'Vincular Drive', exact: true }).click(); await page.getByRole('button', { name: 'Brief del proyecto.pdf', exact: true }).waitFor();
 await capture('proyecto-selector-drive.png'); await page.getByRole('button', { name: 'Diseño', exact: false }).last().click(); await page.getByRole('button', { name: 'Brief del proyecto.pdf', exact: true }).click(); await page.getByRole('button', { name: 'Vincular archivo', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
 await page.getByRole('button', { name: 'Páginas web', exact: true }).click(); await page.getByText('Guía de accesibilidad de W3C', { exact: true }).waitFor(); await capture('proyecto-paginas-guardadas.png');
 await page.getByRole('button', { name: 'Abrir navegador', exact: true }).click(); await page.getByRole('button', { name: 'Lanzamiento del producto', exact: true }).waitFor(); await capture('proyecto-guardar-pagina.png'); await page.getByRole('button', { name: 'Lanzamiento del producto', exact: true }).click(); await page.getByRole('button', { name: 'Guardar página', exact: true }).click(); await page.getByText('Página guardada en Lanzamiento del producto.').waitFor(); await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
 await page.getByRole('button', { name: 'Chats del proyecto', exact: true }).click(); await page.getByRole('heading', { name: 'Chats del proyecto' }).waitFor(); await capture('proyecto-chats.png');
 await page.getByRole('button', { name: 'Archivos', exact: true }).click(); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(390, 844));
 await page.getByRole('button', { name: 'Menú compacto por el ancho disponible' }).waitFor(); await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().width < 100); await capture('proyecto-archivos-compacto.png');
 if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw new Error('Archivos desborda el viewport.');
 if (errors.length) throw new Error(errors.join('\n'));
 console.log('Smoke Electron correcto: archivos unificados, vista previa, selector Drive, páginas, selección de proyecto, chats y ancho compacto. Datos simulados.');
} finally { await app?.close(); await server.close(); }
