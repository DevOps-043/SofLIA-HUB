import { BrowserWindow, globalShortcut, screen } from 'electron';
import path from 'node:path';
import {
  captureForegroundWindow,
  type FlowInsertTarget,
} from '../flow-window/native-window-target';

interface FlowWindowControllerOptions {
  preloadPath: string;
  rendererDist: string;
  devServerUrl?: string;
  logError: (scope: string, error: unknown) => void;
  getWindow: () => BrowserWindow | null;
  setWindow: (window: BrowserWindow | null) => void;
  setInsertTarget: (target: FlowInsertTarget | null) => void;
}

export function createFlowWindowController(options: FlowWindowControllerOptions) {
  const rememberInsertTarget = async (): Promise<void> => {
    const target = await captureForegroundWindow(options.logError);
    if (!target || target.title.toLowerCase().includes('soflia hub')) {
      options.setInsertTarget(null);
      return;
    }
    options.setInsertTarget(target);
  };

  const createFlowWindow = async (): Promise<void> => {
    await rememberInsertTarget();
    const current = options.getWindow();
    if (current) {
      current.showInactive();
      current.webContents.send('flow-window-shown');
      return;
    }

    const flowWindow = new BrowserWindow({
      width: 600,
      height: 450,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      movable: true,
      show: false,
      webPreferences: {
        preload: options.preloadPath,
        additionalArguments: ['--view-mode=flow'],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    options.setWindow(flowWindow);
    flowWindow.setAlwaysOnTop(true, 'screen-saver');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    flowWindow.setPosition(Math.floor(width / 2 - 300), Math.floor(height - 480));
    if (options.devServerUrl) {
      void flowWindow.loadURL(`${options.devServerUrl}?view=flow`);
    } else {
      void flowWindow.loadFile(path.join(options.rendererDist, 'index.html'), { query: { view: 'flow' } });
    }
    flowWindow.once('ready-to-show', () => {
      flowWindow.showInactive();
      flowWindow.webContents.send('flow-window-shown');
    });
    flowWindow.on('closed', () => options.setWindow(null));
    flowWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(permission === 'media');
    });
  };

  const registerFlowShortcut = (): void => {
    const accelerator = 'CommandOrControl+M';
    globalShortcut.unregister(accelerator);
    const registered = globalShortcut.register(accelerator, () => { void createFlowWindow(); });
    if (!registered) {
      console.warn(`[BOOT] No se pudo registrar el atajo global ${accelerator}`);
      return;
    }
    console.log(`[BOOT] Atajo global registrado: ${accelerator} -> modo voz`);
  };

  return { createFlowWindow, registerFlowShortcut };
}
