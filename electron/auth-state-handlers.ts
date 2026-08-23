import { ipcMain } from 'electron';
import { getAuthState, setAuthState, type MainAuthState } from './main/auth-state';
import { applyHubSession, revokeHubSession } from './main/hub-session';
import { getProjectHubApiService } from './project-hub';

/**
 * Contrato del canal: el renderer publica su estado de sesion tras iniciarla,
 * cerrarla o restaurarla.
 *
 * El payload tiene DOS partes con reglas distintas:
 *
 *  - El estado observable (`authenticated`, `userId`): se guarda en
 *    `main/auth-state.ts` y se puede volver a leer por `auth:get-state`.
 *  - La credencial (`accessToken`, `refreshToken`): entra y NO sale. No se
 *    guarda en el estado observable, no se devuelve por ningun canal y no se
 *    registra. Solo se entrega a `hub-session`, que la cifra en disco.
 *
 * Este canal rechazaba tokens a proposito hasta esta version. Se admiten ahora
 * porque sin identidad el proceso main es `anon` ante la base y toda politica
 * por usuario le devuelve cero filas: la eleccion de canales del usuario no se
 * aplicaba en WhatsApp ni Telegram, y las Skills que solo viven en la base no
 * existian alli. La guarda anterior se sustituye por las tres de arriba, no se
 * elimina sin mas.
 */

interface AuthStatePayload extends MainAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sofiaAccessToken: string | null;
}

function optionalToken(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseAuthStatePayload(payload: unknown): AuthStatePayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as {
    authenticated?: unknown;
    userId?: unknown;
    accessToken?: unknown;
    refreshToken?: unknown;
    sofiaAccessToken?: unknown;
  };
  if (typeof candidate.authenticated !== 'boolean') return null;
  if (candidate.userId !== undefined && candidate.userId !== null && typeof candidate.userId !== 'string') {
    return null;
  }
  return {
    authenticated: candidate.authenticated,
    userId: typeof candidate.userId === 'string' ? candidate.userId : null,
    accessToken: optionalToken(candidate.accessToken),
    refreshToken: optionalToken(candidate.refreshToken),
    sofiaAccessToken: optionalToken(candidate.sofiaAccessToken),
  };
}

export function registerAuthStateHandlers(): void {
  ipcMain.handle('auth:set-state', async (_event, payload: unknown) => {
    const parsed = parseAuthStatePayload(payload);
    if (!parsed) {
      console.warn('[AUTH] Payload de estado invalido; se conserva el estado actual.');
      return { ok: false, state: getAuthState() };
    }

    // El estado observable se fija primero: las guardas de las funciones
    // sensibles dependen de el y no deben esperar a la red.
    const state = setAuthState({ authenticated: parsed.authenticated, userId: parsed.userId });

    if (!parsed.authenticated) {
      await Promise.all([revokeHubSession(), getProjectHubApiService().logout()]);
    } else if (parsed.accessToken && parsed.refreshToken) {
      // Sin tokens no se falla: una version anterior del renderer o un flujo que
      // aun no los publique deja a main como `anon`, que es el estado seguro.
      await applyHubSession(
        { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken },
        parsed.userId,
      );
    }

    if (parsed.authenticated && parsed.sofiaAccessToken) {
      const projectHubExchange = await getProjectHubApiService().exchangeSofiaToken(parsed.sofiaAccessToken);
      if (!projectHubExchange.success) {
        console.warn(`[ProjectHub] Canje SOFIA rechazado (${projectHubExchange.code || 'UNKNOWN'}): ${projectHubExchange.error || 'sin detalle'}`);
      }
    }

    return { ok: true, state };
  });

  // Devuelve SOLO el estado observable. Nunca credenciales.
  ipcMain.handle('auth:get-state', () => getAuthState());
}
