import { BrowserWindow, desktopCapturer, screen } from 'electron';

/**
 * Captura de pantalla con soporte MULTI-MONITOR.
 *
 * Antes se devolvia siempre `sources[0]` (la pantalla principal) y el tamaño se
 * calculaba con el display primario: con varios monitores, SofLIA solo "veia" uno.
 * Ahora se puede elegir monitor y, si no se indica ninguno, se captura aquel
 * donde esta el cursor (el que el usuario esta mirando).
 */

interface DisplayInfo {
  index: number;
  display_id: string;
  name: string;
  primary: boolean;
  width: number;
  height: number;
  /** true si el cursor del usuario esta en este monitor. */
  active: boolean;
}

export async function handleListScreens(): Promise<Record<string, any>> {
  try {
    console.log('[ComputerUse] Fetching screen sources...');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    });
    const displays = describeDisplays();
    // Se conserva el contrato original (id, name, display_id) y se añade la
    // informacion de monitor para que el modelo pueda elegir uno.
    const screens = sources.map((source: any, position: number) => {
      const display = displays.find((item) => item.display_id === String(source.display_id));
      return {
        id: source.id,
        name: source.name,
        display_id: source.display_id,
        index: display?.index ?? position + 1,
        primary: display?.primary ?? false,
        active: display?.active ?? false,
      };
    });
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
    const displays = describeDisplays();
    const target = resolveTargetDisplay(args, displays);
    onProgress?.(`Capturando ${target.name}${displays.length > 1 ? ` (monitor ${target.index} de ${displays.length})` : ''}...`);

    const { targetWidth, targetHeight } = resolveScreenshotSize(args, target);
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

    // Un display_id explicito manda sobre todo lo demas: se busca directamente
    // entre las fuentes reales de captura (son la referencia autoritativa).
    const requestedDisplayId = args.display_id ? String(args.display_id) : null;
    const targetSource = (requestedDisplayId
      ? sources.find((source: any) => String(source.display_id) === requestedDisplayId)
      : null)
      ?? sources.find((source: any) => String(source.display_id) === target.display_id)
      ?? sources[Math.min(target.index - 1, sources.length - 1)]
      ?? sources[0];
    if (!targetSource?.thumbnail) {
      return { success: false, error: 'No se pudo generar la captura de la pantalla (thumbnail indefinido).' };
    }

    const axTree = await readAccessibilityTree(onProgress);
    return {
      success: true,
      image: targetSource.thumbnail.toDataURL(),
      // El modelo necesita saber que hay mas monitores para poder pedir otro.
      captured_display: { index: target.index, name: target.name, primary: target.primary },
      available_displays: displays.map((display) => ({
        index: display.index, name: display.name, primary: display.primary, active: display.active,
      })),
      axTree,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Lista los monitores con su indice (1..N), marcando el primario y el activo. */
function describeDisplays(): DisplayInfo[] {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  let activeId: number | null = null;
  try {
    activeId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
  } catch {
    activeId = primaryId;
  }
  return displays.map((display, position) => ({
    index: position + 1,
    display_id: String(display.id),
    name: display.label || `Monitor ${position + 1}${display.id === primaryId ? ' (principal)' : ''}`,
    primary: display.id === primaryId,
    width: Math.floor(display.size.width * display.scaleFactor),
    height: Math.floor(display.size.height * display.scaleFactor),
    active: display.id === activeId,
  }));
}

/**
 * Resuelve el monitor pedido. Acepta `display_index` (1..N), `display_id`, o
 * `display` con "principal"/"activa"/numero. Sin argumentos: el monitor donde
 * esta el cursor (antes siempre era el primario).
 */
function resolveTargetDisplay(args: Record<string, any>, displays: DisplayInfo[]): DisplayInfo {
  const fallback = displays.find((display) => display.active) ?? displays[0];
  if (args.display_id) {
    return displays.find((display) => display.display_id === String(args.display_id)) ?? fallback;
  }

  const raw = args.display_index ?? args.display ?? args.monitor;
  if (raw === undefined || raw === null || raw === '') return fallback;

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= displays.length) {
    return displays[Math.floor(asNumber) - 1];
  }
  const normalized = String(raw).toLowerCase();
  if (normalized.includes('princip') || normalized.includes('primar')) {
    return displays.find((display) => display.primary) ?? fallback;
  }
  if (normalized.includes('activ') || normalized.includes('actual')) return fallback;
  return fallback;
}

function resolveScreenshotSize(args: Record<string, any>, target: DisplayInfo): { targetWidth: number; targetHeight: number } {
  // El tamaño sale del monitor DESTINO (antes siempre del primario: las capturas
  // de un monitor con otra resolucion salian deformadas o recortadas).
  let targetWidth = target.width || 1920;
  let targetHeight = target.height || 1080;
  if (args.width) targetWidth = Number(args.width);
  if (args.height) targetHeight = Number(args.height);
  return { targetWidth, targetHeight };
}

async function readAccessibilityTree(onProgress?: (message: string) => void): Promise<any | undefined> {
  try {
    onProgress?.('Leyendo el arbol de accesibilidad...');
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
