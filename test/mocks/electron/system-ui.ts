import { vi } from 'vitest';

export const shell = {
  openPath: vi.fn(async () => ''),
  openExternal: vi.fn(async () => {}),
  showItemInFolder: vi.fn(),
};

export const clipboard = {
  readText: vi.fn(() => ''),
  writeText: vi.fn(),
  readHTML: vi.fn(() => ''),
  writeHTML: vi.fn(),
  readImage: vi.fn(() => ({ isEmpty: () => true, toDataURL: () => '' })),
  writeImage: vi.fn(),
  clear: vi.fn(),
};

export const safeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
  decryptString: vi.fn((buffer: Buffer) => buffer.toString().replace('encrypted:', '')),
};

export const dialog = {
  showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [] })),
  showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: '' })),
  showMessageBox: vi.fn(async () => ({ response: 0, checkboxChecked: false })),
  showErrorBox: vi.fn(),
};

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

export const globalShortcut = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false),
};
