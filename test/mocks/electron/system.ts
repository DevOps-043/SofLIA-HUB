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

export const globalShortcut = {
  register: vi.fn(() => true),
  unregister: vi.fn(),
  unregisterAll: vi.fn(),
  isRegistered: vi.fn(() => false),
};
