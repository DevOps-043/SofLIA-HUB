import { vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-userdata'),
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('[]'),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('[]'),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: Function) => {
    if (typeof _opts === 'function') {
      _opts(null, '', '');
    } else if (cb) {
      cb(null, '', '');
    }
    return { kill: vi.fn() };
  }),
}));
