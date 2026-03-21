import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain, shell, clipboard, desktopCapturer } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import { exec } from 'node:child_process';

// ============================================================================
// Computer Use Handlers Tests (CU-001 to CU-100)
// Tests for electron/computer-use-handlers.ts — filesystem ops, command
// execution security, clipboard, system info, search, screenshots, email,
// and security edge cases.
// ============================================================================

// ─── Module-level mocks ─────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
    cp: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    rm: vi.fn(),
  },
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  cp: vi.fn(),
  copyFile: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  rm: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    accessSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    statSync: vi.fn(() => ({ isDirectory: () => false, size: 100 })),
  },
  existsSync: vi.fn(() => true),
  accessSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => false, size: 100 })),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: Function) => {
    cb(null, '', '');
  }),
  execFile: vi.fn((_file: string, _args: any, _opts: any, cb: Function) => {
    cb(null, '', '');
  }),
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
  getFileExtension: vi.fn((f: string) => {
    const ext = f.split('.').pop() || '';
    return ext;
  }),
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

// Nodemailer and systeminformation mocks
const mockTransporter = {
  verify: vi.fn(async () => true),
  sendMail: vi.fn(async (_message: { html?: string; text?: string }) => ({ messageId: 'msg-123' })),
};
const mockNodemailer = {
  createTransport: vi.fn(() => mockTransporter),
};
const mockSi = {
  processes: vi.fn(async () => ({
    list: [
      { pid: 1, name: 'test-proc', cpu: 10.5, mem: 5.2, command: 'test' },
      { pid: 2, name: 'idle', cpu: 0.1, mem: 0.5, command: '' },
    ],
  })),
};
const mockTrashItem = vi.fn(async () => undefined);

// ─── Import executeToolDirect + registerComputerUseHandlers ─────────────────

let executeToolDirect: (toolName: string, args: Record<string, any>, onProgress?: (msg: string) => void) => Promise<any>;
let registerComputerUseHandlers: () => void;

beforeEach(async () => {
  vi.clearAllMocks();
  (ipcMain as any)._clearHandlers();
  Object.defineProperty(shell, 'trashItem', {
    value: mockTrashItem,
    configurable: true,
    writable: true,
  });
  mockTrashItem.mockResolvedValue(undefined);

  const mod = await import('../computer-use-handlers');
  executeToolDirect = mod.executeToolDirect;
  registerComputerUseHandlers = mod.registerComputerUseHandlers;
});

// ============================================================================
// FILESYSTEM (CU-001 to CU-033)
// ============================================================================

describe('Filesystem operations', () => {
  // ── read_file ────────────────────────────────────────────────────────────

  it('CU-001: read_file returns content for existing file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 100 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('hello world');
    const result = await executeToolDirect('read_file', { path: '/tmp/test.txt' });
    expect(result.success).toBe(true);
    expect(result.content).toBe('hello world');
  });

  it('CU-002: read_file rejects files >1MB', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 2 * 1024 * 1024 } as any);
    const result = await executeToolDirect('read_file', { path: '/tmp/big.bin' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/demasiado grande/i);
  });

  it('CU-003: read_file uses UTF-8 encoding', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 50 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('contenido en espanol');
    const result = await executeToolDirect('read_file', { path: '/tmp/espanol.txt' });
    expect(result.success).toBe(true);
    expect(fs.readFile).toHaveBeenCalledWith(expect.any(String), 'utf-8');
  });

  it('CU-004: read_file returns error for nonexistent file', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT: no such file'));
    const result = await executeToolDirect('read_file', { path: '/tmp/nope.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });

  it('CU-005: read_file handles empty path gracefully', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('read_file', { path: '' });
    expect(result.success).toBe(false);
  });

  it('CU-006: read_file handles paths with special characters', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 10 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('data');
    const result = await executeToolDirect('read_file', { path: '/tmp/file with spaces & (parens).txt' });
    expect(result.success).toBe(true);
  });

  it('CU-007: read_file rejects directory paths', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true, size: 4096 } as any);
    const result = await executeToolDirect('read_file', { path: '/tmp/somedir' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/directorio/i);
  });

  // ── write_file ───────────────────────────────────────────────────────────

  it('CU-008: write_file creates a new file', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/new.txt', content: 'hello' });
    expect(result.success).toBe(true);
    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/new.txt', 'hello', 'utf-8');
  });

  it('CU-009: write_file overwrites existing file', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/existing.txt', content: 'overwritten' });
    expect(result.success).toBe(true);
  });

  it('CU-010: write_file creates parent directories', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    await executeToolDirect('write_file', { path: '/tmp/deep/nested/file.txt', content: 'data' });
    expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('CU-011: write_file handles empty content', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/empty.txt', content: '' });
    expect(result.success).toBe(true);
  });

  it('CU-012: write_file handles Unicode content', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('write_file', { path: '/tmp/unicode.txt', content: 'cafe\u0301 \u00f1 \u00fc \u2603' });
    expect(result.success).toBe(true);
  });

  // ── list_directory ───────────────────────────────────────────────────────

  it('CU-013: list_directory lists existing directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'file.txt', isDirectory: () => false },
      { name: 'subdir', isDirectory: () => true },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 1024, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp/testdir' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('CU-014: list_directory handles empty directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp/empty' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('CU-015: list_directory returns error for nonexistent', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('list_directory', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });

  it('CU-016: list_directory distinguishes files and dirs', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'file.txt', isDirectory: () => false },
      { name: 'folder', isDirectory: () => true },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 100, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp' });
    expect(result.success).toBe(true);
    const file = result.items.find((i: any) => i.name === 'file.txt');
    const dir = result.items.find((i: any) => i.name === 'folder');
    expect(file?.isDirectory).toBe(false);
    expect(dir?.isDirectory).toBe(true);
  });

  it('CU-017: list_directory filters hidden files by default', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 10, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp' });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('visible.txt');
  });

  it('CU-018: list_directory shows hidden when show_hidden=true', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.hidden', isDirectory: () => false },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    vi.mocked(fs.stat).mockResolvedValue({
      size: 10, mtime: new Date(), birthtime: new Date(), isDirectory: () => false,
    } as any);
    const result = await executeToolDirect('list_directory', { path: '/tmp', show_hidden: true });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  // ── create_directory ─────────────────────────────────────────────────────

  it('CU-019: create_directory creates simple directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('create_directory', { path: '/tmp/newdir' });
    expect(result.success).toBe(true);
    expect(fs.mkdir).toHaveBeenCalledWith('/tmp/newdir', { recursive: true });
  });

  it('CU-020: create_directory creates recursive path', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('create_directory', { path: '/tmp/a/b/c' });
    expect(result.success).toBe(true);
  });

  it('CU-021: create_directory handles already exists (EEXIST)', async () => {
    const eexist = Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    vi.mocked(fs.mkdir).mockRejectedValue(eexist);
    const result = await executeToolDirect('create_directory', { path: '/tmp/existing' });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/ya existe/i);
  });

  // ── move_item ────────────────────────────────────────────────────────────

  it('CU-022: move_item moves a file', async () => {
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/b.txt' });
    expect(result.success).toBe(true);
    expect(result.from).toBe('/tmp/a.txt');
    expect(result.to).toBe('/tmp/b.txt');
  });

  it('CU-023: move_item moves a directory', async () => {
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/dir1', destination_path: '/tmp/dir2' });
    expect(result.success).toBe(true);
  });

  it('CU-024: move_item creates parent when ENOENT', async () => {
    vi.mocked(fs.rename)
      .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      .mockResolvedValueOnce(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/deep/b.txt' });
    expect(result.success).toBe(true);
    expect(fs.mkdir).toHaveBeenCalled();
  });

  it('CU-025: move_item returns error on general failure', async () => {
    vi.mocked(fs.rename).mockRejectedValue(new Error('EPERM'));
    const result = await executeToolDirect('move_item', { source_path: '/tmp/a', destination_path: '/tmp/b' });
    expect(result.success).toBe(false);
  });

  // ── copy_item ────────────────────────────────────────────────────────────

  it('CU-026: copy_item copies a file', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as any);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/a.txt', destination_path: '/tmp/b.txt' });
    expect(result.success).toBe(true);
  });

  it('CU-027: copy_item copies directory recursively', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(fs.cp).mockResolvedValue(undefined);
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/dir1', destination_path: '/tmp/dir2' });
    expect(result.success).toBe(true);
    expect(fs.cp).toHaveBeenCalledWith('/tmp/dir1', '/tmp/dir2', { recursive: true });
  });

  it('CU-028: copy_item returns error when source nonexistent', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('copy_item', { source_path: '/tmp/nope', destination_path: '/tmp/dest' });
    expect(result.success).toBe(false);
  });

  // ── delete_item ──────────────────────────────────────────────────────────

  it('CU-029: delete_item sends file to trash', async () => {
    vi.mocked(shell.openPath).mockResolvedValue('');
    const result = await executeToolDirect('delete_item', { path: '/tmp/trash-me.txt' });
    expect(result.success).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith('/tmp/trash-me.txt');
  });

  it('CU-030: delete_item handles directory', async () => {
    const result = await executeToolDirect('delete_item', { path: '/tmp/trash-dir' });
    expect(result.success).toBe(true);
  });

  it('CU-031: delete_item returns error for nonexistent', async () => {
    vi.mocked(shell.trashItem).mockRejectedValue(new Error('File not found'));
    const result = await executeToolDirect('delete_item', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });

  // ── get_file_info ────────────────────────────────────────────────────────

  it('CU-032: get_file_info returns metadata', async () => {
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => false,
      size: 2048,
      birthtime: new Date('2025-01-01'),
      mtime: new Date('2025-06-01'),
      atime: new Date('2025-06-15'),
    } as any);
    const result = await executeToolDirect('get_file_info', { path: '/tmp/info.txt' });
    expect(result.success).toBe(true);
    expect(result.sizeBytes).toBe(2048);
    expect(result.isDirectory).toBe(false);
    expect(result.created).toBeDefined();
    expect(result.modified).toBeDefined();
    expect(result.accessed).toBeDefined();
  });

  it('CU-033: get_file_info returns error for nonexistent', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('get_file_info', { path: '/tmp/nope' });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// COMMAND EXECUTION SECURITY (CU-034 to CU-057)
// ============================================================================

describe('Command Execution Security', () => {
  it('CU-034: execute_command runs simple echo', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'hello', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('hello');
  });

  it('CU-035: execute_command captures stderr', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, '', 'warning message');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'some-cmd' });
    expect(result.success).toBe(true);
    expect(result.stderr).toBe('warning message');
  });

  it('CU-036: execute_command uses 30s timeout', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, opts: any, cb: any) => {
      expect(opts.timeout).toBe(30_000);
      cb(null, '', '');
      return {} as any;
    });
    await executeToolDirect('execute_command', { command: 'test' });
  });

  // ── BLOCKED_COMMANDS: test all 15 blocked patterns ───────────────────────

  const blockedCommands = [
    { id: 'CU-037', pattern: 'format', cmd: 'format C:' },
    { id: 'CU-038', pattern: 'diskpart', cmd: 'diskpart /s script.txt' },
    { id: 'CU-039', pattern: 'cipher /w', cmd: 'cipher /w:C:\\temp' },
    { id: 'CU-040', pattern: 'sfc', cmd: 'sfc /scannow' },
    { id: 'CU-041', pattern: 'bcdedit', cmd: 'bcdedit /set bootmode' },
    { id: 'CU-042', pattern: 'reg delete', cmd: 'reg delete HKLM\\Software\\Test' },
    { id: 'CU-043', pattern: 'reg add', cmd: 'reg add HKLM\\Software\\Test /v val /d data' },
    { id: 'CU-044', pattern: 'shutdown', cmd: 'shutdown /s /t 0' },
    { id: 'CU-045', pattern: 'taskkill /f /im explorer', cmd: 'taskkill /f /im explorer.exe' },
    { id: 'CU-046', pattern: 'rm -rf /', cmd: 'rm -rf / --no-preserve-root' },
    { id: 'CU-047', pattern: 'mkfs', cmd: 'mkfs.ext4 /dev/sda1' },
    { id: 'CU-048', pattern: 'dd if=', cmd: 'dd if=/dev/zero of=/dev/sda bs=1M' },
    { id: 'CU-049', pattern: 'fork bomb', cmd: ':(){:|:&};:' },
    { id: 'CU-050', pattern: 'net user', cmd: 'net user admin pass123 /add' },
    { id: 'CU-051', pattern: 'net localgroup administrators', cmd: 'net localgroup administrators hacker /add' },
  ];

  blockedCommands.forEach(({ id, pattern, cmd }) => {
    it(`${id}: blocks "${pattern}" command`, async () => {
      const result = await executeToolDirect('execute_command', { command: cmd });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/bloqueado/i);
    });
  });

  it('CU-052: allows safe commands like dir', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'output', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'dir' });
    expect(result.success).toBe(true);
  });

  it('CU-053: allows npm list', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'npm list output', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'npm list' });
    expect(result.success).toBe(true);
  });

  it('CU-054: allows git status', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, 'On branch main', '');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'git status' });
    expect(result.success).toBe(true);
  });

  it('CU-055: case insensitive blocking (FORMAT C:)', async () => {
    const result = await executeToolDirect('execute_command', { command: 'FORMAT C:' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-056: blocks command with blocked pattern embedded', async () => {
    const result = await executeToolDirect('execute_command', { command: 'echo test && shutdown /s' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-057: blocks pipe to blocked command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'echo y | format d:' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });
});

// ============================================================================
// CLIPBOARD & SYSTEM (CU-058 to CU-066)
// ============================================================================

describe('Clipboard & System Info', () => {
  it('CU-058: clipboard_read returns clipboard text', async () => {
    vi.mocked(clipboard.readText).mockReturnValue('clipboard content');
    const result = await executeToolDirect('clipboard_read', {});
    expect(result.success).toBe(true);
    expect(result.content).toBe('clipboard content');
  });

  it('CU-059: clipboard_write writes text to clipboard', async () => {
    const result = await executeToolDirect('clipboard_write', { text: 'hello' });
    expect(result.success).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('CU-060: clipboard_read handles empty clipboard', async () => {
    vi.mocked(clipboard.readText).mockReturnValue('');
    const result = await executeToolDirect('clipboard_read', {});
    expect(result.success).toBe(true);
    expect(result.content).toBe('');
  });

  it('CU-061: clipboard_write handles long text', async () => {
    const longText = 'x'.repeat(100_000);
    const result = await executeToolDirect('clipboard_write', { text: longText });
    expect(result.success).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledWith(longText);
  });

  it('CU-062: get_system_info returns CPU info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.cpu).toBeDefined();
    expect(result.cpu.cores).toBeGreaterThan(0);
  });

  it('CU-063: get_system_info returns memory info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.memory).toBeDefined();
    expect(result.memory.total).toBeDefined();
    expect(result.memory.free).toBeDefined();
  });

  it('CU-064: get_system_info returns OS info', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.platform).toBeDefined();
    expect(result.release).toBeDefined();
    expect(result.arch).toBeDefined();
  });

  it('CU-065: get_system_info returns disk paths', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.homeDir).toBeDefined();
    expect(result.tempDir).toBeDefined();
  });

  it('CU-066: get_system_info returns uptime', async () => {
    const result = await executeToolDirect('get_system_info', {});
    expect(result.success).toBe(true);
    expect(result.uptime).toBeDefined();
  });
});

// ============================================================================
// FILE SEARCH (CU-067 to CU-074)
// ============================================================================

describe('File Search', () => {
  it('CU-067: search_files finds by name pattern', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'test.txt', isDirectory: () => false },
      { name: 'other.js', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'test' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].name).toBe('test.txt');
  });

  it('CU-068: search_files respects MAX_SEARCH_RESULTS=200', async () => {
    const entries = Array.from({ length: 300 }, (_, i) => ({
      name: `match-${i}.txt`, isDirectory: () => false,
    }));
    vi.mocked(fs.readdir).mockResolvedValue(entries as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'match' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(200);
  });

  it('CU-069: search_files returns empty for no matches', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'noMatch.txt', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'zzzzz' });
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('CU-070: search_files case insensitive matching', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'MyFile.TXT', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'myfile' });
    expect(result.success).toBe(true);
    expect(result.results.length).toBe(1);
  });

  it('CU-071: search_files skips node_modules', async () => {
    vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
      if (typeof dir === 'string' && dir.includes('node_modules')) {
        return [{ name: 'match.txt', isDirectory: () => false }] as any;
      }
      return [
        { name: 'node_modules', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
      ] as any;
    });
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'match' });
    expect(result.success).toBe(true);
    // node_modules dir itself should be skipped
  });

  it('CU-072: search_files skips .git directories', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: '.git', isDirectory: () => true },
      { name: 'visible.txt', isDirectory: () => false },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'visible' });
    expect(result.success).toBe(true);
    expect(result.results.some((r: any) => r.name === '.git')).toBe(false);
  });

  it('CU-073: search_files defaults to homedir when no directory', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    const result = await executeToolDirect('search_files', { pattern: 'test' });
    expect(result.success).toBe(true);
    expect(result.searchPath).toBe(os.homedir());
  });

  it('CU-074: search_files includes matching directories', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'target-dir', isDirectory: () => true },
    ] as any);
    const result = await executeToolDirect('search_files', { directory: '/tmp', pattern: 'target' });
    expect(result.success).toBe(true);
    expect(result.results[0]?.isDirectory).toBe(true);
  });
});

// ============================================================================
// SCREENSHOTS & PROCESSES (CU-075 to CU-084)
// ============================================================================

describe('Screenshots & Processes', () => {
  it('CU-075: take_screenshot captures screen', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([{
      id: 'screen:0:0',
      name: 'Screen 1',
      display_id: '0',
      thumbnail: { toDataURL: () => 'data:image/png;base64,iVBOR' },
      appIcon: null,
    }] as any);
    const result = await executeToolDirect('take_screenshot', {});
    expect(result.success).toBe(true);
    expect(result.image).toContain('data:image/png;base64');
  });

  it('CU-076: take_screenshot uses configured quality/dimensions', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([{
      id: 'screen:0:0', name: 'Screen', display_id: '0',
      thumbnail: { toDataURL: () => 'data:image/png;base64,abc' },
      appIcon: null,
    }] as any);
    const result = await executeToolDirect('take_screenshot', { width: 800, height: 600 });
    expect(result.success).toBe(true);
    expect(desktopCapturer.getSources).toHaveBeenCalledWith(
      expect.objectContaining({ thumbnailSize: { width: 800, height: 600 } }),
    );
  });

  it('CU-077: take_screenshot handles multi-monitor with display_id', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([
      { id: 'screen:0:0', name: 'Main', display_id: '0', thumbnail: { toDataURL: () => 'main-img' }, appIcon: null },
      { id: 'screen:1:0', name: 'Secondary', display_id: '1', thumbnail: { toDataURL: () => 'sec-img' }, appIcon: null },
    ] as any);
    const result = await executeToolDirect('take_screenshot', { display_id: '1' });
    expect(result.success).toBe(true);
    expect(result.image).toBe('sec-img');
  });

  it('CU-078: take_screenshot returns error when no displays', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([]);
    const result = await executeToolDirect('take_screenshot', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no se encontraron/i);
  });

  it('CU-079: list_processes returns process list', async () => {
    const result = await executeToolDirect('list_processes', {});
    expect(result.success).toBe(true);
    expect(result.processes).toBeDefined();
    expect(result.processes.length).toBeGreaterThan(0);
    expect(result.processes[0]).toHaveProperty('pid');
    expect(result.processes[0]).toHaveProperty('name');
    expect(result.processes[0]).toHaveProperty('cpu');
  });

  it('CU-080: kill_process terminates valid PID', async () => {
    const originalKill = process.kill;
    process.kill = vi.fn() as any;
    const result = await executeToolDirect('kill_process', { pid: 9999 });
    expect(result.success).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(9999, 'SIGKILL');
    process.kill = originalKill;
  });

  it('CU-081: kill_process rejects invalid PID', async () => {
    const result = await executeToolDirect('kill_process', { pid: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/inv.lido/i);
  });

  it('CU-082: kill_process rejects NaN PID', async () => {
    const result = await executeToolDirect('kill_process', { pid: NaN });
    expect(result.success).toBe(false);
  });

  it('CU-083: list_screens returns screen list', async () => {
    vi.mocked(desktopCapturer.getSources).mockResolvedValue([
      { id: 'screen:0:0', name: 'Screen 1', display_id: '0', thumbnail: null, appIcon: null },
    ] as any);
    const result = await executeToolDirect('list_screens', {});
    expect(result.success).toBe(true);
    expect(result.screens).toHaveLength(1);
    expect(result.screens![0]).toHaveProperty('id');
    expect(result.screens![0]).toHaveProperty('name');
  });

  it('CU-084: open_file_on_computer returns error without path', async () => {
    const result = await executeToolDirect('open_file_on_computer', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ruta/i);
  });
});

// ============================================================================
// EMAIL (CU-085 to CU-090)
// ============================================================================

describe('Email operations', () => {
  it('CU-085: send_email sends successfully', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'test@gmail.com', password: 'pass', defaultFrom: 'test@gmail.com',
    }));
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-456' });
    const result = await executeToolDirect('send_email', {
      to: 'dest@gmail.com', subject: 'Test', body: 'Hello',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-456');
  });

  it('CU-086: send_email returns error without email config', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'S', body: 'B',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no configurado/i);
  });

  it('CU-087: send_email supports attachments', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 100 } as any);
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-att' });
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'S', body: 'B', attachment_paths: ['/tmp/file.pdf'],
    });
    expect(result.success).toBe(true);
    expect(result.attachmentsCount).toBe(1);
  });

  it('CU-088: send_email supports HTML body', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'msg-html' });
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'HTML', body: '<h1>Hello</h1>', is_html: true,
    });
    expect(result.success).toBe(true);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
    const firstCall = mockTransporter.sendMail.mock.calls[0];
    const mailCall = firstCall?.[0];
    expect(mailCall).toBeDefined();
    expect(mailCall.html).toBe('<h1>Hello</h1>');
    expect(mailCall.text).toBeUndefined();
  });

  it('CU-089: send_email handles SMTP timeout/error', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      host: 'smtp.gmail.com', port: 587, user: 'u@gmail.com', password: 'p', defaultFrom: 'u@gmail.com',
    }));
    mockTransporter.sendMail.mockRejectedValue(new Error('Connection timed out'));
    const result = await executeToolDirect('send_email', {
      to: 'x@y.com', subject: 'S', body: 'B',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timed out');
  });

  it('CU-090: configure_email rejects unknown provider', async () => {
    const result = await executeToolDirect('configure_email', {
      email: 'user@unknownprovider.xyz', password: 'pass',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SMTP/i);
  });
});

// ============================================================================
// SECURITY EDGE CASES (CU-091 to CU-100)
// ============================================================================

describe('Security Edge Cases', () => {
  it('CU-091: all handlers return {success, error?} on success', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false, size: 10 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('content');
    const result = await executeToolDirect('read_file', { path: '/tmp/test.txt' });
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('CU-092: handler exception does not crash process', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('Unexpected crash'));
    const result = await executeToolDirect('get_file_info', { path: '/tmp/bad' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('CU-093: unknown tool returns {success: false}', async () => {
    const result = await executeToolDirect('nonexistent_tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/desconocida/i);
  });

  it('CU-094: blocked command with mixed case', async () => {
    const result = await executeToolDirect('execute_command', { command: 'ShUtDoWn /s /t 0' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-095: blocked command with leading/trailing whitespace', async () => {
    const result = await executeToolDirect('execute_command', { command: '  format C:  ' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado/i);
  });

  it('CU-096: blocked rd /s /q c:\\ command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'rd /s /q c:\\' });
    expect(result.success).toBe(false);
  });

  it('CU-097: blocked del /f /s /q c:\\ command', async () => {
    const result = await executeToolDirect('execute_command', { command: 'del /f /s /q c:\\windows' });
    expect(result.success).toBe(false);
  });

  it('CU-098: command exec returns exit code on error', async () => {
    vi.mocked(exec).mockImplementation((_cmd: any, _opts: any, cb: any) => {
      const error = Object.assign(new Error('exit code 1'), { code: 1 });
      cb(error, '', 'error output');
      return {} as any;
    });
    const result = await executeToolDirect('execute_command', { command: 'false' });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBeDefined();
  });

  it('CU-099: command exec uses powershell on win32', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    vi.mocked(exec).mockImplementation((_cmd: any, opts: any, cb: any) => {
      expect(opts.shell).toBe('powershell.exe');
      cb(null, '', '');
      return {} as any;
    });
    await executeToolDirect('execute_command', { command: 'Get-Date' });
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  });

  it('CU-100: registerComputerUseHandlers registers all IPC channels', () => {
    registerComputerUseHandlers();
    const registeredChannels = Array.from((ipcMain as any)._getHandlers().keys());

    const expectedChannels = [
      'computer:list-screens',
      'computer:list-processes',
      'computer:kill-process',
      'computer:list-directory',
      'computer:read-file',
      'computer:write-file',
      'computer:create-directory',
      'computer:move-item',
      'computer:copy-item',
      'computer:delete-item',
      'computer:get-file-info',
      'computer:search-files',
      'computer:organize-files',
      'computer:batch-move-files',
      'computer:list-directory-summary',
      'computer:undo-last-file-operation',
      'computer:execute-command',
      'computer:open-application',
      'computer:open-file-on-computer',
      'computer:open-url',
      'computer:run-background-command',
      'computer:list-process-sessions',
      'computer:poll-process-session',
      'computer:kill-process-session',
      'computer:get-system-info',
      'computer:clipboard-read',
      'computer:clipboard-write',
      'computer:use-computer',
      'computer:take-screenshot',
      'computer:confirm-action',
      'computer:get-email-config',
      'computer:configure-email',
      'computer:send-email',
    ];

    for (const channel of expectedChannels) {
      expect(registeredChannels).toContain(channel);
    }
  });
});
