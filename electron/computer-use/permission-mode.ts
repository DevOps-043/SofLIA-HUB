import { ipcMain, type BrowserWindow } from 'electron';
import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import { trustedAppCaller } from '../ipc/caller-authorization';
import { getAuthState } from '../main/auth-state';
import { cancelComputerApproval, showComputerApproval } from './approval-view';
import { assertSafeExternalUrl } from './email-security';
import type { ComputerPermissionMode, ComputerPermissionResponse } from '../../src/shared/computer-permissions';

type Caller = ReturnType<typeof trustedAppCaller>;
const grants = new WeakMap<BrowserWindow, { userId: string | null; signal: AbortSignal; revoke: () => void }>();
const executionScope = new AsyncLocalStorage<AbortSignal | undefined>();

export function fullComputerAccessFor(parent: BrowserWindow | null | undefined): AbortSignal | undefined {
  if (!parent || parent.isDestroyed()) return undefined;
  const { authenticated, userId } = getAuthState();
  const grant = grants.get(parent);
  return authenticated && grant && grant.userId === userId && !grant.signal.aborted ? grant.signal : undefined;
}

export function withComputerAccess<T>(signal: AbortSignal | undefined, operation: () => T): T {
  return executionScope.run(signal, operation);
}

export function currentComputerAccess(): AbortSignal | undefined {
  return executionScope.getStore();
}

function mode(caller: Caller): ComputerPermissionMode {
  return fullComputerAccessFor(caller.parent) ? 'full' : 'review';
}

export function permitsWithoutReview(caller: Caller, operation: string, args: Record<string, unknown>): boolean {
  return mode(caller) === 'full' || (operation === 'open_url' && typeof args.url === 'string' && isLowRiskWebLink(args.url));
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
    let retained = false;
    try {
      caller.assert();
      const [request] = args;
      if (args.length === 0) return { success: true, mode: mode(caller) };
      if (args.length !== 1 || (request !== 'review' && request !== 'full') || !caller.parent) {
        return { success: false, error: 'Modo de permisos no válido.' };
      }
      const parent = caller.parent;
      if (request === 'review') {
        cancelComputerApproval(parent);
        grants.get(parent)?.revoke();
        return { success: true, mode: 'review' };
      }
      if (mode(caller) === 'full') return { success: true, mode: 'full' };
      const allowed = await showComputerApproval(parent, 'Activar Acceso completo',
        'Autorizas a SofLIA a controlar el escritorio y el navegador, ejecutar comandos, modificar o borrar archivos y enviar datos mediante las herramientas disponibles. SofLIA ejecutará esas acciones sin pedir otra aprobación. Puedes retirar el permiso desde el menú +. También termina al cerrar o recargar esta ventana o al cambiar de sesión.',
        caller.assert, caller.signal);
      if (!allowed) return { success: false, mode: 'review', error: 'El permiso no se concedió.' };
      caller.assert();
      if (mode(caller) === 'full') return { success: true, mode: 'full' };
      const grant = { userId: caller.userId, signal: caller.signal, revoke: () => {
        if (grants.get(parent) === grant) grants.delete(parent);
        caller.signal.removeEventListener('abort', grant.revoke);
        caller.dispose();
      } };
      caller.signal.addEventListener('abort', grant.revoke, { once: true });
      grants.set(parent, grant);
      retained = true;
      return { success: true, mode: 'full' };
    } catch { return { success: false, error: 'La sesión o ventana de origen ya no está disponible.' }; }
    finally { if (!retained) caller.dispose(); }
  });
}
