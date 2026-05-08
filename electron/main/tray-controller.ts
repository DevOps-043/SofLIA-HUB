import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import path from 'node:path';

export function createMainTray(input: {
  currentTray: () => Tray | null;
  setTray: (tray: Tray | null) => void;
  getWindow: () => BrowserWindow | null;
  createWindow: (showWindow?: boolean) => void;
  createFlowWindow: () => void;
  setQuitting: (value: boolean) => void;
}): void {
  if (input.currentTray()) return;

  const iconPath = path.join(process.env.VITE_PUBLIC!, 'assets/icono.ico');
  let trayIcon = nativeImage.createEmpty();
  try {
    const loadedIcon = nativeImage.createFromPath(iconPath);
    trayIcon = loadedIcon.isEmpty() ? nativeImage.createEmpty() : loadedIcon;
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  const tray = new Tray(trayIcon);
  tray.setToolTip('SofLIA Hub Desktop');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Abrir SofLIA Hub',
      click: () => {
        const win = input.getWindow();
        if (!win) input.createWindow(true);
        else {
          win.show();
          win.focus();
        }
      },
    },
    { label: 'Modo voz', click: () => input.createFlowWindow() },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        input.setQuitting(true);
        app.quit();
      },
    },
  ]));
  tray.on('click', () => {
    const win = input.getWindow();
    if (!win) {
      input.createWindow(true);
      return;
    }
    if (!win.isVisible()) win.show();
    win.focus();
  });
  input.setTray(tray);
}
