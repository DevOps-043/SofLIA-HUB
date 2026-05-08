import { vi } from 'vitest';
import { EventEmitter } from 'node:events';

// --- app ---
export const app = {
  getPath: vi.fn((name: string) => {
    const paths: Record<string, string> = {
      userData: '/tmp/test-userdata',
      appData: '/tmp/test-appdata',
      temp: '/tmp/test-temp',
      home: '/tmp/test-home',
      desktop: '/tmp/test-desktop',
      documents: '/tmp/test-documents',
      downloads: '/tmp/test-downloads',
    };
    return paths[name] || `/tmp/test-${name}`;
  }),
  getName: vi.fn(() => 'SofLIA-HUB-Test'),
  getVersion: vi.fn(() => '1.0.0-test'),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  isPackaged: false,
};

// --- ipcMain ---
const handlers = new Map<string, Function>();
export const ipcMain = {
  handle: vi.fn((channel: string, handler: Function) => {
    handlers.set(channel, handler);
  }),
  handleOnce: vi.fn((channel: string, handler: Function) => {
    handlers.set(channel, handler);
  }),
  on: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn((channel: string) => {
    handlers.delete(channel);
  }),
  removeAllListeners: vi.fn(),
  // Helper para tests: invocar un handler registrado
  _getHandler: (channel: string) => handlers.get(channel),
  _getHandlers: () => handlers,
  _clearHandlers: () => handlers.clear(),
};

// --- ipcRenderer ---
const rendererListeners = new Map<string, Set<Function>>();
export const ipcRenderer = {
  invoke: vi.fn(async (_channel: string, ..._args: any[]) => ({ success: true })),
  send: vi.fn(),
  on: vi.fn((channel: string, listener: Function) => {
    if (!rendererListeners.has(channel)) rendererListeners.set(channel, new Set());
    rendererListeners.get(channel)!.add(listener);
    return ipcRenderer;
  }),
  off: vi.fn((channel: string, listener: Function) => {
    rendererListeners.get(channel)?.delete(listener);
    return ipcRenderer;
  }),
  removeAllListeners: vi.fn((channel: string) => {
    rendererListeners.delete(channel);
    return ipcRenderer;
  }),
  _listeners: rendererListeners,
};

// --- contextBridge ---
const exposedApis = new Map<string, any>();
export const contextBridge = {
  exposeInMainWorld: vi.fn((apiKey: string, api: any) => {
    exposedApis.set(apiKey, api);
  }),
  _getExposedApi: (apiKey: string) => exposedApis.get(apiKey),
  _getExposedApis: () => exposedApis,
  _clearExposedApis: () => exposedApis.clear(),
};

// --- BrowserWindow ---
export class BrowserWindow extends EventEmitter {
  webContents = {
    send: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    openDevTools: vi.fn(),
    session: { setPermissionRequestHandler: vi.fn() },
    executeJavaScript: vi.fn(),
  };
  loadURL = vi.fn();
  loadFile = vi.fn();
  show = vi.fn();
  hide = vi.fn();
  close = vi.fn();
  destroy = vi.fn();
  isDestroyed = vi.fn(() => false);
  setSize = vi.fn();
  getSize = vi.fn(() => [1024, 768]);
  setPosition = vi.fn();
  getPosition = vi.fn(() => [0, 0]);
  minimize = vi.fn();
  maximize = vi.fn();
  restore = vi.fn();
  focus = vi.fn();
  isVisible = vi.fn(() => true);
  setAlwaysOnTop = vi.fn();
  setBounds = vi.fn();
  getBounds = vi.fn(() => ({ x: 0, y: 0, width: 1024, height: 768 }));
  setMenu = vi.fn();

  static getAllWindows = vi.fn(() => []);
  static getFocusedWindow = vi.fn(() => null);

  constructor(_options?: any) {
    super();
  }
}

// --- desktopCapturer ---
export const desktopCapturer = {
  getSources: vi.fn(async () => [
    {
      id: 'screen:0:0',
      name: 'Entire Screen',
      thumbnail: { toDataURL: () => 'data:image/png;base64,iVBOR...' },
      display_id: '0',
      appIcon: null,
    },
  ]),
};

// --- powerMonitor ---
export const powerMonitor = {
  getSystemIdleTime: vi.fn(() => 0),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
};

// --- shell ---
export const shell = {
  openPath: vi.fn(async () => ''),
  openExternal: vi.fn(async () => {}),
  showItemInFolder: vi.fn(),
};

// --- clipboard ---
export const clipboard = {
  readText: vi.fn(() => ''),
  writeText: vi.fn(),
  readHTML: vi.fn(() => ''),
  writeHTML: vi.fn(),
  readImage: vi.fn(() => ({ isEmpty: () => true, toDataURL: () => '' })),
  writeImage: vi.fn(),
  clear: vi.fn(),
};

// --- safeStorage ---
export const safeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
  decryptString: vi.fn((buffer: Buffer) => buffer.toString().replace('encrypted:', '')),
};

// --- dialog ---
export const dialog = {
  showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [] })),
  showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: '' })),
  showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })),
  showErrorBox: vi.fn(),
};

// --- Tray ---
export class Tray {
  setToolTip = vi.fn();
  setContextMenu = vi.fn();
  on = vi.fn();
  destroy = vi.fn();
  constructor(_iconPath: string) {}
}

// --- Menu ---
export class Menu {
  static buildFromTemplate = vi.fn(() => new Menu());
  static setApplicationMenu = vi.fn();
  popup = vi.fn();
}

// --- nativeImage ---
const createMockNativeImage = () => ({
  isEmpty: () => false,
  toDataURL: () => 'data:image/png;base64,test',
  resize: vi.fn(() => ({ toDataURL: () => 'data:image/png;base64,resized' })),
  getSize: () => ({ width: 100, height: 100 }),
});

export const nativeImage = {
  createFromPath: vi.fn((_path?: string) => createMockNativeImage()),
  createFromDataURL: vi.fn((_dataUrl?: string) => createMockNativeImage()),
  createEmpty: vi.fn(() => ({ isEmpty: () => true })),
};

// --- screen ---
export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    id: 0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    size: { width: 1920, height: 1080 },
  })),
  getAllDisplays: vi.fn(() => [
    {
      id: 0,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      size: { width: 1920, height: 1080 },
    },
  ]),
};

// --- globalShortcut ---
export const globalShortcut = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false),
};

// Default export for `require('electron')` or `import electron from 'electron'`
const electronExport = {
  app,
  ipcMain,
  ipcRenderer,
  contextBridge,
  BrowserWindow,
  desktopCapturer,
  powerMonitor,
  shell,
  clipboard,
  safeStorage,
  dialog,
  Tray,
  Menu,
  nativeImage,
  screen,
  globalShortcut,
};

export default electronExport;
