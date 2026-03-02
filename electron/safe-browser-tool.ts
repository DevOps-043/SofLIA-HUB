import { app, BrowserWindow } from 'electron';

export interface SuspiciousUrlAnalysis {
  title: string;
  finalUrl: string;
  screenshotBase64: string;
  error?: string;
}

/**
 * Analiza una URL de forma segura utilizando una ventana oculta (offscreen).
 * Útil para inspeccionar enlaces sospechosos sin riesgos para el usuario, 
 * evitando descargas automáticas o ejecución de scripts maliciosos en el entorno principal.
 * 
 * @param url La URL dudosa que se desea analizar
 * @returns Objeto con título, URL final (después de redirecciones) y captura de pantalla
 */
export async function analyzeSuspiciousUrl(url: string): Promise<SuspiciousUrlAnalysis> {
  // 1 & 2. Asegurarnos de que la aplicación está lista antes de instanciar BrowserWindow
  await app.whenReady();

  return new Promise((resolve) => {
    // 2. Instanciar un nuevo BrowserWindow en modo offscreen
    let win: BrowserWindow | null = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        // Deshabilitamos plugins y otras características para mayor seguridad
        plugins: false,
        webgl: false,
        enableWebSQL: false,
      },
    });

    let isResolved = false;

    const cleanupAndResolve = (result: SuspiciousUrlAnalysis) => {
      if (isResolved) return;
      isResolved = true;
      
      // 7. Destruir la ventana offscreen
      if (win && !win.isDestroyed()) {
        try {
          win.destroy();
        } catch (e) {
          console.error('[SafeBrowser] Error al destruir la ventana:', e);
        }
      }
      // 8. Retornar el objeto resultante
      resolve(result);
    };

    // 4. Timeout máximo de 15 segundos
    const timeoutId = setTimeout(() => {
      cleanupAndResolve({
        title: 'Timeout Superado',
        finalUrl: win && !win.isDestroyed() ? win.webContents.getURL() : url,
        screenshotBase64: '',
        error: 'La página excedió el tiempo máximo de carga de 15 segundos.',
      });
    }, 15000);

    const targetUrl = url.startsWith('http') ? url : `http://${url}`;

    // 4. Esperar el evento 'did-finish-load'
    win.webContents.on('did-finish-load', async () => {
      clearTimeout(timeoutId);
      if (isResolved || !win || win.isDestroyed()) return;

      try {
        // Pausa breve de seguridad para asegurar que los scripts visuales
        // iniciales hayan terminado de renderizar la página.
        await new Promise((r) => setTimeout(r, 1500));

        if (isResolved || !win || win.isDestroyed()) return;

        // 6. Extraer el título del documento mediante executeJavaScript
        const title = await win.webContents
          .executeJavaScript('document.title')
          .catch(() => 'Título no disponible');
        
        // 5. Capturar la página web de forma segura
        const image = await win.webContents.capturePage();
        const screenshotBase64 = image.toDataURL(); // Devuelve formato data:image/png;base64,...
        
        // 8. Retornar la URL final tras posibles redirecciones (ej. shorteners)
        const finalUrl = win.webContents.getURL();

        cleanupAndResolve({
          title: title || 'Sin Título',
          finalUrl,
          screenshotBase64,
        });
      } catch (err: any) {
        cleanupAndResolve({
          title: 'Error de Análisis',
          finalUrl: win && !win.isDestroyed() ? win.webContents.getURL() : url,
          screenshotBase64: '',
          error: err.message || 'Error al procesar la captura o el título de la página.',
        });
      }
    });

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
      if (!isMainFrame) return; // Ignoramos fallos de iframes secundarios o trackers bloqueados
      
      clearTimeout(timeoutId);
      cleanupAndResolve({
        title: 'Fallo de Carga',
        finalUrl: targetUrl,
        screenshotBase64: '',
        error: `Fallo al cargar la página principal: ${errorDescription} (${errorCode})`,
      });
    });

    // 3. Navegar a la URL dudosa
    win.loadURL(targetUrl).catch((err) => {
      clearTimeout(timeoutId);
      cleanupAndResolve({
        title: 'Error de Navegación',
        finalUrl: targetUrl,
        screenshotBase64: '',
        error: err.message || 'No se pudo iniciar la navegación a la URL especificada.',
      });
    });
  });
}
