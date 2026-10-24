import { app, dialog, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getAuthState, onAuthStateChange } from '../main/auth-state';

export const IPC_APPROVAL_MS = 120000;

export function isAppDocument(value: string): boolean {
  try {
    const expected = new URL(process.env.VITE_DEV_SERVER_URL || pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href);
    const actual = new URL(value);
    return actual.protocol === expected.protocol && actual.host === expected.host && actual.pathname === expected.pathname
      && !actual.username && !actual.password;
  } catch { return false; }
}

/** Contexto de una llamada: cualquier cambio de sesión o navegación la invalida. */
export function trustedAppCaller(event: IpcMainInvokeEvent, windows: () => (BrowserWindow | null)[]) {
  return appSourceContext(event.sender, event.senderFrame, windows);
}

/** Restauración originada en main: usa la ventana real, sin fabricar eventos IPC. */
export function trustedAppWindow(windows: () => (BrowserWindow | null)[]) {
  const parent = windows().find(win => win && !win.isDestroyed());
  if (!parent) throw new Error('context_invalid');
  return appSourceContext(parent.webContents, parent.webContents.mainFrame, windows);
}

function appSourceContext(sender: IpcMainInvokeEvent['sender'], frame: IpcMainInvokeEvent['senderFrame'], windows: () => (BrowserWindow | null)[]) {
  const user = getAuthState();
  const parent = windows().find(win => win && !win.isDestroyed() && win.webContents === sender);
  let changed = false;
  const cancellation = new AbortController();
  const invalidate = () => { changed = true; cancellation.abort(); };
  const unsubscribe = onAuthStateChange(invalidate);
  const navigation = (_event: unknown, _url: string, _inPlace: boolean, main: boolean) => { if (main) invalidate(); };
  if (parent) {
    sender.on('did-start-navigation', navigation);
    sender.on('render-process-gone', invalidate);
    sender.on('destroyed', invalidate);
  }
  const assert = () => {
    const now = getAuthState();
    if (changed || !user.authenticated || !user.userId || !now.authenticated || now.userId !== user.userId
      || !parent || parent.isDestroyed() || !windows().includes(parent) || sender.isDestroyed()
      || !frame || frame.detached || frame !== parent.webContents.mainFrame || !isAppDocument(frame.url) || sender !== parent.webContents) {
      throw new Error('context_invalid');
    }
  };
  return { parent, userId: user.userId, assert, signal: cancellation.signal, dispose: () => {
    invalidate();
    unsubscribe();
    if (parent) {
      sender.removeListener('did-start-navigation', navigation);
      sender.removeListener('render-process-gone', invalidate); sender.removeListener('destroyed', invalidate);
    }
  } };
}

/** Un solo diálogo activo; una respuesta tardía nunca amplía su autorización. */
export function nativeConfirmation(title: string) {
  let pending = false;
  return async (parent: BrowserWindow, detail: string, assert: () => void, signal?: AbortSignal): Promise<boolean> => {
    if (pending) throw new Error('approval_pending');
    assert();
    pending = true;
    const deadline = Date.now() + IPC_APPROVAL_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancellation = new AbortController();
    const dialogSignal = signal ? AbortSignal.any([signal, cancellation.signal]) : cancellation.signal;
    let cancel!: () => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(new Error('approval_cancelled'));
      dialogSignal.addEventListener('abort', cancel, { once: true });
      if (dialogSignal.aborted) cancel();
    });
    try {
      assert();
      const response = await Promise.race([
        Promise.resolve().then(() => { assert(); return dialog.showMessageBox(parent, { type: 'warning', title, signal: dialogSignal,
          message: 'Revisa el cambio antes de autorizarlo.', detail,
          buttons: ['Cancelar', 'Confirmar'], defaultId: 0, cancelId: 0, noLink: true,
        }); }).finally(() => { pending = false; }),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { cancellation.abort(); reject(new Error('approval_expired')); }, IPC_APPROVAL_MS); }),
        aborted,
      ]);
      assert();
      if (Date.now() >= deadline) throw new Error('approval_expired');
      return response.response === 1;
    } finally {
      if (timer) clearTimeout(timer);
      dialogSignal.removeEventListener('abort', cancel);
      // Si vence, el bloqueo se mantiene hasta que el diálogo nativo cierre.
    }
  };
}
