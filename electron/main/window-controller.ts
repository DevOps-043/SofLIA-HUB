import { BrowserWindow } from 'electron';
import path from 'node:path';
import { markBoot } from './boot-timeline';

// Si `ready-to-show` no dispara (entorno atipico o carga bloqueada), se muestra
// la ventana de todos modos tras este tiempo para no dejar al usuario sin UI.
const READY_TO_SHOW_FALLBACK_MS = 4000;

export function createOrFocusMainWindow(input: {
  currentWindow: BrowserWindow | null;
  showWindow: boolean;
  isQuitting: () => boolean;
  preloadPath: string;
  iconPath: string;
  rendererUrl?: string;
  rendererDist: string;
  onClosed: () => void;
}): BrowserWindow {
  if (input.currentWindow) {
    if (input.showWindow) {
      input.currentWindow.show();
      input.currentWindow.focus();
    }
    return input.currentWindow;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    icon: input.iconPath,
    // Siempre oculta al crear: se revela en `ready-to-show` para evitar el
    // destello en blanco. En modo background (showWindow=false) permanece oculta
    // hasta que el usuario/tray la muestre.
    show: false,
    title: ' ',
    webPreferences: {
      preload: input.preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  markBoot('ventana:creada');

  if (input.showWindow) {
    let shown = false;
    const reveal = (motivo: string) => {
      if (shown || win.isDestroyed()) return;
      shown = true;
      clearTimeout(fallbackTimer);
      markBoot(`ventana:visible:${motivo}`);
      win.show();
      win.focus();
    };
    win.once('ready-to-show', () => reveal('ready-to-show'));
    const fallbackTimer = setTimeout(() => reveal('fallback-timeout'), READY_TO_SHOW_FALLBACK_MS);
  }

  win.setMenu(null);
  win.on('close', (event) => {
    if (!input.isQuitting()) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', input.onClosed);

  if (input.rendererUrl) {
    void win.loadURL(input.rendererUrl);
  } else {
    void win.loadFile(path.join(input.rendererDist, 'index.html'));
  }

  win.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  return win;
}
