import { ipcMain } from 'electron';
import { getAuthState, setAuthState, type MainAuthState } from './main/auth-state';

// Contrato del canal: el renderer publica un estado minimo tras iniciar sesion,
// cerrarla o restaurarla. Se valida el payload y se descarta cualquier campo
// extra; no se aceptan tokens ni datos personales.
function parseAuthStatePayload(payload: unknown): MainAuthState | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as { authenticated?: unknown; userId?: unknown };
  if (typeof candidate.authenticated !== 'boolean') return null;
  if (candidate.userId !== undefined && candidate.userId !== null && typeof candidate.userId !== 'string') {
    return null;
  }
  return {
    authenticated: candidate.authenticated,
    userId: typeof candidate.userId === 'string' ? candidate.userId : null,
  };
}

export function registerAuthStateHandlers(): void {
  ipcMain.handle('auth:set-state', (_event, payload: unknown) => {
    const parsed = parseAuthStatePayload(payload);
    if (!parsed) {
      console.warn('[AUTH] Payload de estado invalido; se conserva el estado actual.');
      return { ok: false, state: getAuthState() };
    }
    return { ok: true, state: setAuthState(parsed) };
  });

  ipcMain.handle('auth:get-state', () => getAuthState());
}
