import { BrowserWindow, desktopCapturer, screen } from 'electron';

export async function handleListScreens(): Promise<Record<string, any>> {
  try {
    console.log('[ComputerUse] Fetching screen sources...');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    });
    const screens = sources.map((source: any) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
    }));
    return { success: true, screens, count: screens.length };
  } catch (err: any) {
    console.error('[ComputerUse] Error listing screens:', err);
    return { success: false, error: err.message };
  }
}

export async function handleTakeScreenshot(
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<Record<string, any>> {
  try {
    onProgress?.('Iniciando captura de pantalla...');
    const { targetWidth, targetHeight } = resolveScreenshotSize(args);
    let sources;
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: targetWidth, height: targetHeight },
      });
    } catch (dcErr: any) {
      return { success: false, error: `Error interno de desktopCapturer: ${dcErr.message}` };
    }

    if (!sources || sources.length === 0) return { success: false, error: 'No se encontraron pantallas.' };
    const targetSource = args.display_id
      ? sources.find((source: any) => source.display_id === args.display_id) || sources[0]
      : sources[0];
    if (!targetSource?.thumbnail) {
      return { success: false, error: 'No se pudo generar la captura de la pantalla (thumbnail indefinido). Asegure el uso de Electron Main Process.' };
    }

    const axTree = await readAccessibilityTree(onProgress);
    return { success: true, image: targetSource.thumbnail.toDataURL(), axTree };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function resolveScreenshotSize(args: Record<string, any>): { targetWidth: number; targetHeight: number } {
  let targetWidth = 1920;
  let targetHeight = 1080;
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    targetWidth = Math.floor(primaryDisplay.size.width * primaryDisplay.scaleFactor);
    targetHeight = Math.floor(primaryDisplay.size.height * primaryDisplay.scaleFactor);
  } catch {
    // fallback dimensions are already set
  }
  if (args.width) targetWidth = Number(args.width);
  if (args.height) targetHeight = Number(args.height);
  return { targetWidth, targetHeight };
}

async function readAccessibilityTree(onProgress?: (message: string) => void): Promise<any | undefined> {
  try {
    onProgress?.('Iniciando OCR y extracciÃ³n de Ã¡rbol de accesibilidad visual...');
    const windows = BrowserWindow.getAllWindows?.() || [];
    if (windows.length === 0) return undefined;
    const webContents = (BrowserWindow.getFocusedWindow() || windows[0]).webContents;
    if (!webContents) return undefined;
    if (!webContents.debugger.isAttached()) {
      try { webContents.debugger.attach('1.3'); } catch { /* might be attached already */ }
    }
    return webContents.debugger.sendCommand('Accessibility.getFullAXTree');
  } catch (err: any) {
    console.error('Error fetching AXTree:', err);
    return undefined;
  }
}
