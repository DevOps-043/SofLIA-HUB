import { dialog, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { rendererSource } from './renderer-source';
export { isAppDocument } from './renderer-source';

export const IPC_APPROVAL_MS = 120000;

export class AppCallerSessionError extends Error {
  constructor(readonly code: 'SOFIA_SESSION_PENDING' | 'SESSION_CHANGED') {
    super('context_invalid');
  }
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
  const source = rendererSource(sender, frame, windows);
  const cancellation = new AbortController();
  const invalidate = () => cancellation.abort();
  const unsubscribe = onAuthStateChange(invalidate);
  const assert = () => {
    source.assert();
    const now = getAuthState();
    if (cancellation.signal.aborted || user.authenticated !== now.authenticated || now.userId !== user.userId) {
      throw new AppCallerSessionError('SESSION_CHANGED');
    }
    if (!user.authenticated || !user.userId) {
      throw new AppCallerSessionError('SOFIA_SESSION_PENDING');
    }
  };
  return { parent: source.parent, userId: user.userId, assert, signal: AbortSignal.any([source.signal, cancellation.signal]), dispose: () => {
    invalidate();
    unsubscribe();
    source.dispose();
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
