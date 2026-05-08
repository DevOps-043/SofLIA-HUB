import { app, type BrowserWindow } from 'electron';
import type { SuspiciousUrlAnalysis } from './safe-browser/types';
import {
  createSuspiciousUrlWindow,
  normalizeTargetUrl,
  SAFE_BROWSER_TIMEOUT_MS,
} from './safe-browser/window';

export type { SuspiciousUrlAnalysis } from './safe-browser/types';

export async function analyzeSuspiciousUrl(url: string): Promise<SuspiciousUrlAnalysis> {
  await app.whenReady();

  return new Promise((resolve) => {
    let win: BrowserWindow | null = createSuspiciousUrlWindow();
    let isResolved = false;

    const cleanupAndResolve = (result: SuspiciousUrlAnalysis) => {
      if (isResolved) return;
      isResolved = true;

      if (win && !win.isDestroyed()) {
        try {
          win.destroy();
        } catch (e) {
          console.error('[SafeBrowser] Error al destruir la ventana:', e);
        }
      }

      resolve(result);
    };

    const targetUrl = normalizeTargetUrl(url);
    const timeoutId = setTimeout(() => {
      cleanupAndResolve({
        title: 'Timeout Superado',
        finalUrl: win && !win.isDestroyed() ? win.webContents.getURL() : url,
        screenshotBase64: '',
        error: 'La pagina excedio el tiempo maximo de carga de 15 segundos.',
      });
    }, SAFE_BROWSER_TIMEOUT_MS);

    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeoutId);
      if (isResolved || !win || win.isDestroyed()) return;

      try {
        await new Promise((r) => setTimeout(r, 1500));
        if (isResolved || !win || win.isDestroyed()) return;

        const title = await win.webContents
          .executeJavaScript('document.title')
          .catch(() => 'Titulo no disponible');
        const image = await win.webContents.capturePage();
        const finalUrl = win.webContents.getURL();

        cleanupAndResolve({
          title: title || 'Sin Titulo',
          finalUrl,
          screenshotBase64: image.toDataURL(),
        });
      } catch (err: any) {
        cleanupAndResolve({
          title: 'Error de Analisis',
          finalUrl: win && !win.isDestroyed() ? win.webContents.getURL() : url,
          screenshotBase64: '',
          error: err.message || 'Error al procesar la captura o el titulo de la pagina.',
        });
      }
    });

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (!isMainFrame) return;

      clearTimeout(timeoutId);
      cleanupAndResolve({
        title: 'Fallo de Carga',
        finalUrl: targetUrl,
        screenshotBase64: '',
        error: `Fallo al cargar la pagina principal: ${errorDescription} (${errorCode})`,
      });
    });

    win.loadURL(targetUrl).catch((err) => {
      clearTimeout(timeoutId);
      cleanupAndResolve({
        title: 'Error de Navegacion',
        finalUrl: targetUrl,
        screenshotBase64: '',
        error: err.message || 'No se pudo iniciar la navegacion a la URL especificada.',
      });
    });
  });
}
