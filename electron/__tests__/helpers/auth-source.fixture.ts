import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';

/** Puertos nativos sustituidos: no crea ventanas ni inicia Electron. */
export function authSourceFixture() {
  const frame = { url: pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href, detached: false };
  let destroyed = false;
  const sender = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: () => destroyed });
  const window = { webContents: sender, isDestroyed: () => destroyed } as unknown as BrowserWindow;
  return {
    sender, frame, window,
    event: { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent,
    destroy: () => { destroyed = true; sender.emit('destroyed'); },
  };
}
