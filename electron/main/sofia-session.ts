import { discardSofiaClient, getSofiaClient, getSofiaCredentials } from '../iris/clients';
import {
  clearSofiaRefreshToken,
  hasStoredSofiaSession,
  readSofiaRefreshToken,
  saveSofiaRefreshToken,
} from './sofia-session-store';

export interface SofiaSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type SofiaSessionStatus = 'aplicada' | 'sin-sesion' | 'rechazada' | 'no-disponible';
export interface SofiaSessionResult {
  status: SofiaSessionStatus;
  userId: string | null;
}

type SofiaSessionApplication =
  | { status: 'aplicada'; userId: string; accessToken: string }
  | { status: Exclude<SofiaSessionStatus, 'aplicada'>; userId: string | null; revoked?: true };

let currentUserId: string | null = null;
let refreshListenerBound = false;
let pendingMutation: Promise<unknown> = Promise.resolve();

export function getSofiaSessionUserId(): string | null {
  return currentUserId;
}

export function isSofiaMainSessionConfigured(): boolean {
  return getSofiaCredentials() !== null;
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = pendingMutation.then(operation, operation);
  pendingMutation = next.then(() => undefined, () => undefined);
  return next;
}

function bindRefreshPersistence(): void {
  if (refreshListenerBound) return;
  const client = getSofiaClient();
  if (!client) return;
  client.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED' || !session?.refresh_token || session.user.id !== currentUserId) return;
    saveSofiaRefreshToken(session.refresh_token);
  });
  refreshListenerBound = true;
}

export function applySofiaSession(
  tokens: SofiaSessionTokens,
  expectedUserId: string,
): Promise<SofiaSessionApplication> {
  return serialize(async () => {
    const accessToken = String(tokens.accessToken || '').trim();
    const refreshToken = String(tokens.refreshToken || '').trim();
    const expected = String(expectedUserId || '').trim();
    if (!accessToken || !refreshToken || !expected) return result('sin-sesion');

    const client = getSofiaClient();
    if (!client) return result('no-disponible');

    try {
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      const authenticatedUserId = data.session?.user?.id ?? null;
      if (error || !authenticatedUserId || expected !== authenticatedUserId) {
        const revoked = error?.name === 'AuthSessionMissingError';
        console.warn('[SofiaSession] La sesión publicada no pudo verificarse.', {
          motivo: revoked ? 'sesion_revocada' :
            error ? 'respuesta_auth' : authenticatedUserId ? 'identidad_distinta' : 'sesion_ausente',
          estadoHttp: error?.status,
          codigo: error?.code && /^[a-z0-9_]{1,64}$/.test(error.code) ? error.code : undefined,
        });
        await denyCurrentSession();
        return revoked ? { ...result('rechazada'), revoked: true } : result('rechazada');
      }

      currentUserId = authenticatedUserId;
      bindRefreshPersistence();
      saveSofiaRefreshToken(data.session?.refresh_token || refreshToken);
      console.log('[SofiaSession] Sesion aplicada: main opera con identidad SOFIA.');
      return { status: 'aplicada', userId: authenticatedUserId, accessToken: data.session?.access_token || accessToken };
    } catch (error) {
      console.warn('[SofiaSession] No se pudo aplicar la sesion:', describe(error));
      // `setSession` pudo modificar estado interno antes de lanzar. Ante un
      // resultado incierto se revoca localmente y el gate permanece cerrado.
      await denyCurrentSession();
      return result('no-disponible');
    }
  });
}

export function restoreSofiaSession(): Promise<SofiaSessionResult> {
  return serialize(async () => {
    if (!hasStoredSofiaSession()) return result('sin-sesion');
    const refreshToken = readSofiaRefreshToken();
    if (!refreshToken) return result('sin-sesion');

    const client = getSofiaClient();
    if (!client) return result('no-disponible');

    try {
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      const authenticatedUserId = data.session?.user?.id ?? null;
      if (error || !data.session || !authenticatedUserId) {
        console.warn('[SofiaSession] La sesion guardada ya no es valida; se descarta.');
        await denyCurrentSession();
        return result('rechazada');
      }

      currentUserId = authenticatedUserId;
      bindRefreshPersistence();
      saveSofiaRefreshToken(data.session.refresh_token);
      console.log('[SofiaSession] Sesion restaurada antes de iniciar los servicios.');
      return result('aplicada');
    } catch (error) {
      console.warn('[SofiaSession] No se pudo restaurar la sesion:', describe(error));
      return result('no-disponible');
    }
  });
}

export function revokeSofiaSession(): Promise<void> {
  return serialize(async () => {
    await denyCurrentSession();
    console.log('[SofiaSession] Sesión local descartada en main.');
  });
}

async function denyCurrentSession(): Promise<void> {
  clearSofiaRefreshToken();
  currentUserId = null;
  refreshListenerBound = false;
  try {
    await discardSofiaClient();
  } catch {
    console.warn('[SofiaSession] No se pudo detener la renovación del cliente anterior.');
  }
}

function result<T extends SofiaSessionStatus>(status: T): { status: T; userId: string | null } {
  return { status, userId: currentUserId };
}

export function resetSofiaSessionForTests(): void {
  currentUserId = null;
  refreshListenerBound = false;
  pendingMutation = Promise.resolve();
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
