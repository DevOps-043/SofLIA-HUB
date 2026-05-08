import { vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
}));

vi.mock('node:module', () => ({
  createRequire: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({
      currentLoad: vi.fn().mockResolvedValue({ currentLoad: 25 }),
      mem: vi.fn().mockResolvedValue({ free: 8e9, total: 16e9 }),
      cpuTemperature: vi.fn().mockResolvedValue({ main: 45 }),
    }),
  ),
}));

vi.mock('archiver', () => ({
  default: vi.fn().mockReturnValue({
    on: vi.fn(),
    directory: vi.fn(),
    file: vi.fn(),
    finalize: vi.fn(),
  }),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('contenido de prueba'),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock('@whiskeysockets/baileys', () => ({
  downloadMediaMessage: vi.fn().mockResolvedValue(Buffer.from('test')),
}));
