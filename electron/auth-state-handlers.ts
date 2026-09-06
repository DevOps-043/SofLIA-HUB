import { ipcMain } from 'electron';
import { getAuthState, setAuthState, type MainAuthState } from './main/auth-state';
import { applyHubSession, revokeHubSession } from './main/hub-session';
import {
  applySofiaSession,
  getSofiaSessionUserId,
  isSofiaMainSessionConfigured,
  revokeSofiaSession,
} from './main/sofia-session';
import { getProjectHubApiService } from './project-hub';

/**
 * Contrato del canal: el renderer publica su estado de sesion tras iniciarla,
 * cerrarla o restaurarla.
 *
 * El payload tiene DOS partes con reglas distintas:
 *
 *  - El estado observable (`authenticated`, `userId`): se guarda en
 *    `main/auth-state.ts` y se puede volver a leer por `auth:get-state`.
 *  - Las credenciales Lia y SOFIA: entran y NO salen. No se guardan en el
 *    estado observable, no se devuelven por ningun canal y no se registran.
 *    Sus coordinadores conservan únicamente cada refresh token cifrado.
 *
 * Este canal rechazaba tokens a proposito hasta esta version. Se admiten ahora
 * porque sin identidad el proceso main es `anon` ante la base y toda politica
 * por usuario le devuelve cero filas o un rechazo: Lia perdía preferencias y
 * Skills, mientras SOFIA no podía resolver organizaciones ni la identidad que
 * autoriza WhatsApp. La guarda anterior se sustituye por las tres de arriba, no
 * se elimina sin mas.
 */

interface AuthStatePayload extends MainAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  sofiaAccessToken: string | null;
  sofiaRefreshToken: string | null;
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
    sofiaRefreshToken?: unknown;
  };
  if (typeof candidate.authenticated !== 'boolean') return null;
  if (candidate.userId !== undefined && candidate.userId !== null && typeof candidate.userId !== 'string') {
    return null;
  }
  const userId = typeof candidate.userId === 'string' ? candidate.userId.trim() : null;
  if (candidate.authenticated && !userId) return null;
  const accessToken = optionalToken(candidate.accessToken);
  const refreshToken = optionalToken(candidate.refreshToken);
  const sofiaAccessToken = optionalToken(candidate.sofiaAccessToken);
  const sofiaRefreshToken = optionalToken(candidate.sofiaRefreshToken);
  // Se aceptan ambos ausentes para compatibilidad, nunca un par parcial.
  if (Boolean(accessToken) !== Boolean(refreshToken)) return null;
  if (Boolean(sofiaAccessToken) !== Boolean(sofiaRefreshToken)) return null;
  return {
    authenticated: candidate.authenticated,
    userId,
    accessToken,
    refreshToken,
    sofiaAccessToken,
    sofiaRefreshToken,
  };
}

export function registerAuthStateHandlers(): void {
  ipcMain.handle('auth:set-state', async (_event, payload: unknown) => {
    const parsed = parseAuthStatePayload(payload);
    if (!parsed) {
      console.warn('[AUTH] Payload de estado invalido; se conserva el estado actual.');
      return { ok: false, state: getAuthState() };
    }

    if (!parsed.authenticated) {
      // El gate se cierra antes de esperar operaciones remotas o de disco.
      const state = setAuthState({ authenticated: false, userId: null });
      await Promise.all([revokeSofiaSession(), revokeHubSession(), getProjectHubApiService().logout()]);
      return { ok: true, state };
    }

    let verifiedSofiaUserId = getSofiaSessionUserId();
    if (parsed.sofiaAccessToken && parsed.sofiaRefreshToken) {
      const sofiaResult = await applySofiaSession(
        { accessToken: parsed.sofiaAccessToken, refreshToken: parsed.sofiaRefreshToken },
        parsed.userId!,
      );
      verifiedSofiaUserId = sofiaResult.status === 'aplicada' ? sofiaResult.userId : null;
    }

    const sofiaRequired = isSofiaMainSessionConfigured();
    const authenticated = sofiaRequired
      ? Boolean(verifiedSofiaUserId && verifiedSofiaUserId === parsed.userId)
      : parsed.authenticated;
    const state = setAuthState({ authenticated, userId: authenticated ? parsed.userId : null });

    if (parsed.accessToken && parsed.refreshToken) {
      // Sin tokens no se falla: una version anterior del renderer o un flujo que
      // aun no los publique deja a main como `anon`, que es el estado seguro.
      await applyHubSession(
        { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken },
        parsed.userId,
      );
    }

    if (authenticated && parsed.sofiaAccessToken) {
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
