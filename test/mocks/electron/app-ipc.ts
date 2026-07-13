import { vi } from 'vitest';

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
  getAppPath: vi.fn(() => '/tmp/test-app'),
  getName: vi.fn(() => 'SofLIA-HUB-Test'),
  getVersion: vi.fn(() => '1.0.0-test'),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  isPackaged: false,
};

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
  _getHandler: (channel: string) => handlers.get(channel),
  _getHandlers: () => handlers,
  _clearHandlers: () => handlers.clear(),
};

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

const exposedApis = new Map<string, any>();
export const contextBridge = {
  exposeInMainWorld: vi.fn((apiKey: string, api: any) => {
    exposedApis.set(apiKey, api);
  }),
  _getExposedApi: (apiKey: string) => exposedApis.get(apiKey),
  _getExposedApis: () => exposedApis,
  _clearExposedApis: () => exposedApis.clear(),
};
