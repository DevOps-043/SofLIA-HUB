import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

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

export class Tray {
  setToolTip = vi.fn();
  setContextMenu = vi.fn();
  on = vi.fn();
  destroy = vi.fn();
  constructor(_iconPath: string) {}
}

export class Menu {
  static buildFromTemplate = vi.fn(() => new Menu());
  static setApplicationMenu = vi.fn();
  popup = vi.fn();
}

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
