// =============================================================================
// Pulse Hub - Ventana flotante de la Orbe de Voz
// =============================================================================
// Reemplaza al Flow Mode. La ventana vive oculta (hide, no destroy) y reaparece
// al instante con la wake word "soflia", Ctrl+M o el menu del tray.
//
// Fix de la race del wake word: el estado inicial NO viaja como evento push
// (se perdia si React aun no montaba listeners). Se guarda como pendingWake y
// el renderer lo consulta con invoke('orb:get-pending-wake') al montarse.
// Solo cuando la ventana ya esta viva se usa el push 'orb:wake'.
// =============================================================================
import { app, BrowserWindow, globalShortcut, screen, type Rectangle } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { canUseProtectedFeature } from './require-auth';
import { onAuthStateChange } from './auth-state';

const ORB_WIDTH = 420;
// La vista de voz necesita ~516 px (handle + orbe de 340 px + estado).
// Evitar una superficie transparente alta que intercepte clics innecesarios.
const ORB_MAX_HEIGHT = 540;
const ORB_MARGIN = 16;
const ORB_MIN_VISIBLE_WIDTH = 96;
const ORB_STATE_VERSION = 1;

interface StoredOrbWindowState {
  version: number;
  bounds: Rectangle;
}

function getOrbStatePath(): string {
  return path.join(app.getPath('userData'), 'orb-window-state.json');
}

function isFiniteRectangle(value: unknown): value is Rectangle {
  if (!value || typeof value !== 'object') return false;
  const rect = value as Partial<Rectangle>;
  return [rect.x, rect.y, rect.width, rect.height].every((coordinate) => Number.isFinite(coordinate));
}

function getHeightForWorkArea(workArea: Rectangle): number {
  return Math.min(ORB_MAX_HEIGHT, Math.max(320, workArea.height - ORB_MARGIN * 2));
}

function clampToWorkArea(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const height = getHeightForWorkArea(workArea);
  const minimumX = workArea.x - ORB_WIDTH + ORB_MIN_VISIBLE_WIDTH;
  const maximumX = workArea.x + workArea.width - ORB_MIN_VISIBLE_WIDTH;
  const maximumY = Math.max(workArea.y, workArea.y + workArea.height - height);
  return {
    x: Math.round(Math.min(maximumX, Math.max(minimumX, bounds.x))),
    y: Math.round(Math.min(maximumY, Math.max(workArea.y, bounds.y))),
    width: ORB_WIDTH,
    height,
  };
}

function getDefaultBounds(): Rectangle {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const height = getHeightForWorkArea(display.workArea);
  return {
    x: display.workArea.x + ORB_MARGIN,
    y: display.workArea.y + Math.max(ORB_MARGIN, Math.round((display.workArea.height - height) / 2)),
    width: ORB_WIDTH,
    height,
  };
}

function normalizeBounds(bounds: Rectangle): Rectangle {
  const matchingDisplay = screen.getDisplayMatching(bounds);
  return clampToWorkArea(bounds, matchingDisplay.workArea);
}

function readStoredBounds(): Rectangle | null {
  try {
    if (!fs.existsSync(getOrbStatePath())) return null;
    const parsed = JSON.parse(fs.readFileSync(getOrbStatePath(), 'utf8')) as Partial<StoredOrbWindowState>;
    if (parsed.version !== ORB_STATE_VERSION || !isFiniteRectangle(parsed.bounds)) return null;
    return normalizeBounds(parsed.bounds);
  } catch (error) {
    console.warn('[OrbWindow] No se pudo restaurar la posición:', error);
    return null;
  }
}

function persistBounds(bounds: Rectangle): void {
  try {
    const state: StoredOrbWindowState = {
      version: ORB_STATE_VERSION,
      bounds: {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: ORB_WIDTH,
        height: Math.round(bounds.height),
      },
    };
    fs.writeFileSync(getOrbStatePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.warn('[OrbWindow] No se pudo guardar la posición:', error);
  }
}

interface OrbWindowControllerOptions {
  preloadPath: string;
  rendererDist: string;
  devServerUrl?: string;
  getWindow: () => BrowserWindow | null;
  setWindow: (window: BrowserWindow | null) => void;
  setPendingWake: (value: boolean) => void;
}

export function createOrbWindowController(options: OrbWindowControllerOptions) {
  const createOrbWindow = async (wake = false): Promise<void> => {
    // Negacion por defecto: sin sesion la orbe no se crea ni se muestra. Cubre
    // wake word, atajo global y tray, que son los tres puntos de entrada.
    if (!canUseProtectedFeature()) {
      console.warn('[AUTH] Orbe bloqueada: no hay sesion iniciada.');
      options.setPendingWake(false);
      return;
    }

    const current = options.getWindow();
    if (current) {
      const safeBounds = normalizeBounds(current.getBounds());
      if (JSON.stringify(safeBounds) !== JSON.stringify(current.getBounds())) current.setBounds(safeBounds, false);
      if (!current.isVisible()) current.showInactive();
      if (wake) current.webContents.send('orb:wake');
      return;
    }

    if (wake) options.setPendingWake(true);
    const initialBounds = readStoredBounds() ?? getDefaultBounds();
    const orbWindow = new BrowserWindow({
      ...initialBounds,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      webPreferences: {
        preload: options.preloadPath,
        additionalArguments: ['--view-mode=orb'],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    options.setWindow(orbWindow);
    let persistTimer: ReturnType<typeof setTimeout> | null = null;
    const flushBounds = () => {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = null;
      if (!orbWindow.isDestroyed()) persistBounds(orbWindow.getBounds());
    };
    const scheduleBoundsPersistence = () => {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(flushBounds, 180);
    };
    const ensureVisible = () => {
      if (orbWindow.isDestroyed()) return;
      const currentBounds = orbWindow.getBounds();
      const safeBounds = normalizeBounds(currentBounds);
      if (JSON.stringify(safeBounds) !== JSON.stringify(currentBounds)) orbWindow.setBounds(safeBounds, false);
    };

    orbWindow.setAlwaysOnTop(true, 'screen-saver');
    if (options.devServerUrl) {
      void orbWindow.loadURL(`${options.devServerUrl}?view=orb`);
    } else {
      void orbWindow.loadFile(path.join(options.rendererDist, 'index.html'), { query: { view: 'orb' } });
    }
    orbWindow.once('ready-to-show', () => {
      orbWindow.showInactive();
    });
    // La orbe no tiene consola visible: sus mensajes propios ([Orb]) se reenvian
    // al log principal para poder diagnosticar fallos (voz, agente) desde la terminal.
    orbWindow.webContents.on('console-message', (event) => {
      const message = String(event.message ?? '');
      if (!message.startsWith('[Orb]')) return;
      const level = String(event.level ?? 'info');
      console.log(`[OrbRenderer][${level.toUpperCase()}] ${message}`);
    });
    orbWindow.on('move', scheduleBoundsPersistence);
    orbWindow.on('hide', flushBounds);
    orbWindow.on('close', flushBounds);
    screen.on('display-removed', ensureVisible);
    screen.on('display-metrics-changed', ensureVisible);
    orbWindow.on('closed', () => {
      if (persistTimer) clearTimeout(persistTimer);
      screen.removeListener('display-removed', ensureVisible);
      screen.removeListener('display-metrics-changed', ensureVisible);
      options.setWindow(null);
    });
    orbWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'media');
    });
  };

  // Revocacion: al pasar a "no autenticado" la orbe se cierra y deja de
  // responder a wake word/atajo hasta que exista una sesion nueva.
  onAuthStateChange((state) => {
    if (state.authenticated) return;
    options.setPendingWake(false);
    const orbWindow = options.getWindow();
    if (!orbWindow || orbWindow.isDestroyed()) return;
    console.warn('[AUTH] Sesion cerrada: se cierra la orbe.');
    orbWindow.close();
  });

  const registerOrbShortcut = (): void => {
    const accelerator = 'CommandOrControl+M';
    globalShortcut.unregister(accelerator);
    const registered = globalShortcut.register(accelerator, () => { void createOrbWindow(true); });
    if (!registered) {
      console.warn(`[BOOT] No se pudo registrar el atajo global ${accelerator}`);
      return;
    }
    console.log(`[BOOT] Atajo global registrado: ${accelerator} -> orbe de voz`);
  };

  return { createOrbWindow, registerOrbShortcut };
}
