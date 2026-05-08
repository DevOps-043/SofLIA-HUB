import { BrowserWindow } from 'electron';
import path from 'node:path';

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
    show: input.showWindow,
    webPreferences: {
      preload: input.preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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
