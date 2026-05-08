import { vi } from 'vitest';

const computerUseMocks = vi.hoisted(() => {
  const transporter = {
    verify: vi.fn(async () => true),
    sendMail: vi.fn(async (_message: { html?: string; text?: string }) => ({ messageId: 'msg-123' })),
  };
  return {
    mockTransporter: transporter,
    mockNodemailer: { createTransport: vi.fn(() => transporter) },
    mockSi: {
      processes: vi.fn(async () => ({
        list: [
          { pid: 1, name: 'test-proc', cpu: 10.5, mem: 5.2, command: 'test' },
          { pid: 2, name: 'idle', cpu: 0.1, mem: 0.5, command: '' },
        ],
      })),
    },
    mockTrashItem: vi.fn(async () => undefined),
  };
});

export const mockTransporter = computerUseMocks.mockTransporter;
export const mockNodemailer = computerUseMocks.mockNodemailer;
export const mockSi = computerUseMocks.mockSi;
export const mockTrashItem = computerUseMocks.mockTrashItem;

vi.mock('node:fs/promises', () => ({
  default: { readdir: vi.fn(), stat: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), rename: vi.fn(), cp: vi.fn(), copyFile: vi.fn(), access: vi.fn(), unlink: vi.fn(), rm: vi.fn() },
  readdir: vi.fn(), stat: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), rename: vi.fn(), cp: vi.fn(), copyFile: vi.fn(), access: vi.fn(), unlink: vi.fn(), rm: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn(() => true), accessSync: vi.fn(), readFileSync: vi.fn(() => '{}'), writeFileSync: vi.fn(), statSync: vi.fn(() => ({ isDirectory: () => false, size: 100 })) },
  existsSync: vi.fn(() => true),
  accessSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => false, size: 100 })),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: Function) => { cb(null, '', ''); }),
  execFile: vi.fn((_file: string, _args: any, _opts: any, cb: Function) => { cb(null, '', ''); }),
  spawn: vi.fn(() => ({
    pid: 1234,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    once: vi.fn(),
    kill: vi.fn(),
  })),
}));

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => (mod: string) => {
    if (mod === 'nodemailer') return mockNodemailer;
    if (mod === 'systeminformation') return mockSi;
    if (mod === 'tesseract.js') return { createWorker: vi.fn() };
    return {};
  }),
}));

vi.mock('../visual-debugger-service', () => ({
  VisualDebuggerService: { handleVisualError: vi.fn() },
}));

vi.mock('../utils/file-utils', () => ({
  normalizePath: vi.fn((p: string) => p),
  formatBytes: vi.fn((b: number) => `${b} B`),
  getFileExtension: vi.fn((f: string) => f.split('.').pop() || ''),
}));

vi.mock('../computer-use/batch-file-ops', () => ({
  organizeFiles: vi.fn(async () => ({ success: true })),
  batchMoveFiles: vi.fn(async () => ({ success: true })),
  listDirectorySummary: vi.fn(async () => ({ success: true })),
  undoLastFileOperation: vi.fn(async () => ({ success: true })),
}));

vi.mock('../background-process-service', () => ({
  backgroundProcessService: {
    launchApplication: vi.fn(async () => ({ id: 'session-1', status: 'running', pid: 1234 })),
    startBackgroundCommand: vi.fn(async () => ({ id: 'bg-1' })),
    listSessions: vi.fn(async () => []),
    getSession: vi.fn(async () => null),
    killSession: vi.fn(async () => null),
  },
}));
