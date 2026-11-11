import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function isAppDocument(value: string): boolean {
  try {
    const expected = new URL(process.env.VITE_DEV_SERVER_URL || pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href);
    const actual = new URL(value);
    return actual.protocol === expected.protocol && actual.host === expected.host && actual.pathname === expected.pathname
      && !actual.username && !actual.password;
  } catch { return false; }
}

/** Fuente nativa vigente. No concede identidad ni exige una sesión previa. */
export function rendererSource(sender: IpcMainInvokeEvent['sender'], frame: IpcMainInvokeEvent['senderFrame'], windows: () => (BrowserWindow | null)[]) {
  const parent = windows().find(win => win && !win.isDestroyed() && win.webContents === sender);
  const cancellation = new AbortController();
  const invalidate = () => cancellation.abort();
  // Electron actual expone detalles; conservar compatibilidad con argumentos posicionales.
  const isMain = (details: unknown, legacy: unknown) => {
    const flag = details && typeof details === 'object' ? (details as { isMainFrame?: unknown }).isMainFrame : undefined;
    return typeof flag === 'boolean' ? flag : legacy;
  };
  const navigation = (details: unknown, _url: string, _inPlace: boolean, main: boolean) => { if (isMain(details, main) !== false) invalidate(); };
  const inPage = (details: unknown, _url: string, main: boolean) => { if (isMain(details, main) !== false) invalidate(); };
  if (parent) {
    sender.on('did-start-navigation', navigation);
    sender.on('did-navigate-in-page', inPage);
    sender.on('render-process-gone', invalidate);
    sender.on('destroyed', invalidate);
  }
  const assert = () => {
    if (cancellation.signal.aborted || !parent || parent.isDestroyed() || !windows().includes(parent) || sender.isDestroyed()
      || sender !== parent.webContents || !frame || frame.detached || frame !== sender.mainFrame || !isAppDocument(frame.url)) {
      throw new Error('context_invalid');
    }
  };
  return { parent, assert, signal: cancellation.signal, dispose: () => {
    invalidate();
    if (parent) {
      sender.removeListener('did-start-navigation', navigation);
      sender.removeListener('did-navigate-in-page', inPage);
      sender.removeListener('render-process-gone', invalidate);
      sender.removeListener('destroyed', invalidate);
    }
  } };
}
