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
  getName: vi.fn(() => 'SofLIA-HUB-Test'),
  getVersion: vi.fn(() => '1.0.0-test'),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  quit: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  isPackaged: false,
};
