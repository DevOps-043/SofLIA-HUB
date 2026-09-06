import { getSofiaClient, getSofiaCredentials } from '../iris/clients';
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
    if (event !== 'TOKEN_REFRESHED' || !session?.refresh_token) return;
    saveSofiaRefreshToken(session.refresh_token);
  });
  refreshListenerBound = true;
}

export function applySofiaSession(
  tokens: SofiaSessionTokens,
  expectedUserId: string,
): Promise<SofiaSessionResult> {
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
        console.warn('[SofiaSession] La sesion publicada fue rechazada o no coincide con el usuario esperado.');
        await denyCurrentSession(client);
        return result('rechazada');
      }

      currentUserId = authenticatedUserId;
      bindRefreshPersistence();
      saveSofiaRefreshToken(data.session?.refresh_token || refreshToken);
      console.log('[SofiaSession] Sesion aplicada: main opera con identidad SOFIA.');
      return result('aplicada');
    } catch (error) {
      console.warn('[SofiaSession] No se pudo aplicar la sesion:', describe(error));
      // `setSession` pudo modificar estado interno antes de lanzar. Ante un
      // resultado incierto se revoca localmente y el gate permanece cerrado.
      await denyCurrentSession(client);
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
        await denyCurrentSession(client);
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
    const client = getSofiaClient();
    if (!client) {
      clearSofiaRefreshToken();
      currentUserId = null;
      return;
    }
    await denyCurrentSession(client);
    console.log('[SofiaSession] Sesion revocada: main vuelve a operar sin identidad SOFIA.');
  });
}

async function denyCurrentSession(client: NonNullable<ReturnType<typeof getSofiaClient>>): Promise<void> {
  clearSofiaRefreshToken();
  currentUserId = null;
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('[SofiaSession] No se pudo cerrar la sesion local del cliente:', describe(error));
  }
}

function result(status: SofiaSessionStatus): SofiaSessionResult {
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
