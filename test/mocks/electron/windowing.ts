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

export const powerMonitor = {
  getSystemIdleTime: vi.fn(() => 0),
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
};

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
