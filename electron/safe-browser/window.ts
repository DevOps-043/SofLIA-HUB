import { BrowserWindow } from 'electron';

export const SAFE_BROWSER_TIMEOUT_MS = 15000;

export function normalizeTargetUrl(url: string): string {
  return url.startsWith('http') ? url : `http://${url}`;
}

export function createSuspiciousUrlWindow(): BrowserWindow {
  return new BrowserWindow({
    show: false,
    width: 1280,
    height: 800,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      plugins: false,
      webgl: false,
      enableWebSQL: false,
    },
  });
}
