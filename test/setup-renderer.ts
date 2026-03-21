import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(String(key), String(value));
    }),
  };
}

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock(),
  writable: true,
});

// Mock window.electronAPI for renderer tests
const mockInvoke = vi.fn(async () => ({ success: true }));
const mockSend = vi.fn();
const mockOn = vi.fn();
const mockRemoveAllListeners = vi.fn();

Object.defineProperty(window, 'ipcRenderer', {
  value: {
    invoke: mockInvoke,
    send: mockSend,
    on: mockOn,
    off: vi.fn(),
    removeAllListeners: mockRemoveAllListeners,
  },
  writable: true,
});

Object.defineProperty(window, 'computerUse', {
  value: {
    listDirectory: vi.fn(async () => ({ success: true, entries: [] })),
    readFile: vi.fn(async () => ({ success: true, content: '' })),
    writeFile: vi.fn(async () => ({ success: true })),
    createDirectory: vi.fn(async () => ({ success: true })),
    moveItem: vi.fn(async () => ({ success: true })),
    copyItem: vi.fn(async () => ({ success: true })),
    deleteItem: vi.fn(async () => ({ success: true })),
    getFileInfo: vi.fn(async () => ({ success: true })),
    searchFiles: vi.fn(async () => ({ success: true, results: [] })),
    executeCommand: vi.fn(async () => ({ success: true, stdout: '', stderr: '' })),
    openApplication: vi.fn(async () => ({ success: true })),
    openUrl: vi.fn(async () => ({ success: true })),
    getSystemInfo: vi.fn(async () => ({ success: true })),
    clipboardRead: vi.fn(async () => ({ success: true, text: '' })),
    clipboardWrite: vi.fn(async () => ({ success: true })),
    takeScreenshot: vi.fn(async () => ({ success: true, data: '' })),
  },
  writable: true,
});

Object.defineProperty(window, 'screenCapture', {
  value: {
    captureScreen: vi.fn(async () => null),
    getScreenSources: vi.fn(async () => []),
  },
  writable: true,
});

// Set test environment variables
process.env.VITE_GEMINI_API_KEY = 'test-gemini-key';
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
