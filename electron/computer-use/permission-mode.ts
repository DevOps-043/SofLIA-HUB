import { ipcMain, type BrowserWindow } from 'electron';
import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { cancelComputerApproval, showComputerApproval } from './approval-view';
import { assertSafeExternalUrl } from './email-security';
import type { ComputerPermissionMode, ComputerPermissionResponse } from '../../src/shared/computer-permissions';
import { readFullComputerAccess, saveFullComputerAccess } from './permission-preference';

type PermissionSession = {
  userId: string;
  ready: Promise<void>;
  grant?: AbortController;
  activation?: AbortController;
};
let session: PermissionSession | undefined;
const executionScope = new AsyncLocalStorage<AbortSignal | undefined>();

function permissionSession(): PermissionSession | undefined {
  const { authenticated, userId } = getAuthState();
  if (!authenticated || !userId) return undefined;
  if (session?.userId === userId) return session;
  const current: PermissionSession = { userId, ready: readFullComputerAccess(userId).then(full => {
    if (session === current && full) current.grant = new AbortController();
  }) };
  session = current;
  const unsubscribe = onAuthStateChange(() => {
    if (session === current) session = undefined;
    current.grant?.abort();
    current.activation?.abort();
    unsubscribe();
  });
  return current;
}

export async function fullComputerAccessFor(parent: BrowserWindow | null | undefined): Promise<AbortSignal | undefined> {
  if (!parent || parent.isDestroyed()) return undefined;
  const current = permissionSession();
  await current?.ready;
  if (current !== session || parent.isDestroyed()) return undefined;
  return current?.grant?.signal;
}

export function withComputerAccess<T>(signal: AbortSignal | undefined, operation: () => T): T {
  return executionScope.run(signal, operation);
}

export function currentComputerAccess(): AbortSignal | undefined {
  return executionScope.getStore();
}

function mode(current: PermissionSession): ComputerPermissionMode {
  return current.grant ? 'full' : 'review';
}

export function permitsWithoutReview(operation: string, args: Record<string, unknown>): boolean {
  return operation === 'open_url' && typeof args.url === 'string' && isLowRiskWebLink(args.url);
}

function isLowRiskWebLink(value: string): boolean {
  try {
    const url = new URL(assertSafeExternalUrl(value));
    const host = url.hostname.replace(/\.$/, '');
    return url.protocol === 'https:' && !url.port && !url.search && !url.hash && url.pathname === '/' && !isIP(host)
      && /^[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}$/i.test(host) && !/\.(?:local|localhost|internal|lan|home|onion)$/i.test(host);
  } catch { return false; }
}

export function registerComputerPermissions(windows: () => (BrowserWindow | null)[]): void {
  ipcMain.handle('computer:cancel-review', (event, ...args: unknown[]) => {
    const caller = trustedAppCaller(event, windows);
    try {
      caller.assert();
      if (args.length || !caller.parent) return { success: false };
      cancelComputerApproval(caller.parent);
      return { success: true };
    } catch { return { success: false }; }
    finally { caller.dispose(); }
  });
  ipcMain.handle('computer:permission-mode', async (event, ...args: unknown[]): Promise<ComputerPermissionResponse> => {
    const caller = trustedAppCaller(event, windows);
    try {
      caller.assert();
      const [request] = args;
      const parent = caller.parent;
      if (!parent || (args.length !== 0 && (args.length !== 1 || (request !== 'review' && request !== 'full')))) {
        return { success: false, error: 'Modo de permisos no válido.' };
      }
      const current = permissionSession()!;
      await current.ready;
      caller.assert();
      if (args.length === 0) return { success: true, mode: mode(current) };
      if (request === 'review') {
        for (const window of windows()) if (window) cancelComputerApproval(window);
        current.activation?.abort();
        current.grant?.abort();
        current.grant = undefined;
        try { await saveFullComputerAccess(current.userId, false, () => {}); }
        catch { return { success: false, mode: 'review', error: 'Se retiró el permiso de la sesión, pero no se pudo quitar la autorización guardada.' }; }
        caller.assert();
        return { success: true, mode: 'review' };
      }
      if (current.grant) return { success: true, mode: 'full' };
      if (current.activation) return { success: false, mode: 'review', error: 'Ya hay una autorización en revisión.' };
      const activation = new AbortController();
      const signal = AbortSignal.any([activation.signal, caller.signal]);
      const assert = () => { caller.assert(); signal.throwIfAborted(); };
      current.activation = activation;
      try {
        const allowed = await showComputerApproval(parent, 'Activar Acceso completo',
          'Autorizas a SofLIA a controlar el escritorio y el navegador, ejecutar comandos, modificar o borrar archivos y enviar datos mediante las herramientas disponibles. SofLIA guardará el permiso para tu cuenta en este equipo y lo restaurará al reiniciar. Puedes retirarlo desde el menú +.',
          assert, signal);
        if (!allowed) return { success: false, mode: 'review', error: 'El permiso no se concedió.' };
        assert();
        try { await saveFullComputerAccess(current.userId, true, assert); }
        catch { return { success: false, mode: 'review', error: 'No se pudo guardar Acceso completo en este equipo.' }; }
        assert();
        current.grant = new AbortController();
        return { success: true, mode: 'full' };
      } finally { current.activation = undefined; }
    } catch { return { success: false, error: 'La sesión o ventana de origen ya no está disponible.' }; }
    finally { caller.dispose(); }
  });
}
