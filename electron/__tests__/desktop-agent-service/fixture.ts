import { beforeEach, vi } from 'vitest';

const desktopAgentMocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(() => false),
  mockReadFileSync: vi.fn(() => '{}'),
  mockWriteFileSync: vi.fn(),
}));

export const mockExistsSync = desktopAgentMocks.mockExistsSync;
export const mockReadFileSync = desktopAgentMocks.mockReadFileSync;
export const mockWriteFileSync = desktopAgentMocks.mockWriteFileSync;

vi.mock('node:fs', () => ({
  default: {
    existsSync: desktopAgentMocks.mockExistsSync,
    readFileSync: desktopAgentMocks.mockReadFileSync,
    writeFileSync: desktopAgentMocks.mockWriteFileSync,
  },
  existsSync: desktopAgentMocks.mockExistsSync,
  readFileSync: desktopAgentMocks.mockReadFileSync,
  writeFileSync: desktopAgentMocks.mockWriteFileSync,
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: any) => {
    if (cb) cb(null, '', '');
    return {} as any;
  }),
}));

vi.mock('node:module', () => ({
  createRequire: vi.fn(() => (mod: string) => mod === 'sharp' ? null : {}),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(async () => ({
        response: { text: () => JSON.stringify({ action: 'done', message: 'Task completed' }) },
      })),
    })),
  })),
}));

vi.mock('../../browser-web-service', () => ({
  BrowserWebService: vi.fn(function BrowserWebService() {
    return {
    setApiKey: vi.fn(),
    getStatus: vi.fn(() => ({ status: 'idle', currentStep: 0 })),
    abort: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    };
  }),
}));

vi.mock('../../windows-uia-service', () => ({
  WindowsUIAService: vi.fn(function WindowsUIAService() {
    return {
    setApiKey: vi.fn(),
    getStatus: vi.fn(() => ({ status: 'idle', currentStep: 0 })),
    abort: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    };
  }),
}));

const desktopAgentTypes = await import('../../desktop-agent-types');

export const DEFAULT_CONFIG = desktopAgentTypes.DEFAULT_CONFIG;
export const loadConfig = desktopAgentTypes.loadConfig;
export const saveConfig = desktopAgentTypes.saveConfig;
export const SEND_KEYS_MAP = desktopAgentTypes.SEND_KEYS_MAP;
export const PINVOKE_HEADER = desktopAgentTypes.PINVOKE_HEADER;
export const LEFTDOWN = desktopAgentTypes.LEFTDOWN;
export const LEFTUP = desktopAgentTypes.LEFTUP;
export const RIGHTDOWN = desktopAgentTypes.RIGHTDOWN;
export const RIGHTUP = desktopAgentTypes.RIGHTUP;
export const WHEEL = desktopAgentTypes.WHEEL;

beforeEach(() => {
  mockExistsSync.mockReset().mockReturnValue(false);
  mockReadFileSync.mockReset().mockReturnValue('{}');
  mockWriteFileSync.mockReset();
});

export async function createDesktopAgentService(): Promise<any> {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
  const mod = await import('../../desktop-agent-service');
  return new mod.DesktopAgentService();
}
