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
    // Ventana frameless para soportar barra de pestañas integrada tipo navegador
    frame: false,
    titleBarStyle: 'hidden',
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
  // Sin menu no hay acelerador de DevTools, y sin DevTools no hay forma de
  // diagnosticar el renderer. Se reponen los atajos sin devolver la barra.
  win.webContents.on('before-input-event', (event, input) => {
    const esF12 = input.key === 'F12';
    const esCombinacion = input.control && input.shift && input.key.toLowerCase() === 'i';
    if (input.type !== 'keyDown' || (!esF12 && !esCombinacion)) return;
    event.preventDefault();
    if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
    else win.webContents.openDevTools({ mode: 'detach' });
  });
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
