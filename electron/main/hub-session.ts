import { getHubDbClient } from '../hub-db-client';
import {
  clearHubRefreshToken,
  hasStoredHubSession,
  readHubRefreshToken,
  saveHubRefreshToken,
} from './hub-session-store';

/**
 * Identidad del proceso main frente a la base de datos del Hub.
 *
 * Main NO inicia sesion por su cuenta: recibe del renderer los tokens de una
 * sesion ya emitida. Duplicar el login aqui significaria duplicar tambien el SSO
 * federado y crear un segundo sitio donde equivocarse; el renderer sigue siendo
 * el unico punto de autenticacion.
 *
 * La alternativa —una clave `service_role` en main— se descarto: funcionaria sin
 * sesion, pero pondria una llave maestra en cada instalador y el aislamiento
 * entre usuarios pasaria a depender de que el codigo filtre bien por `user_id`,
 * que es exactamente lo que RLS existe para no tener que confiar.
 */

export interface HubSessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type HubSessionResult = 'aplicada' | 'sin-sesion' | 'rechazada' | 'no-disponible';

/** Usuario con el que main esta operando ahora mismo. */
let currentUserId: string | null = null;
let refreshListenerBound = false;

export function getHubSessionUserId(): string | null {
  return currentUserId;
}

/**
 * Renovar el token produce uno nuevo; si no se guardara, el siguiente arranque
 * usaria uno ya consumido. Se engancha una sola vez por proceso.
 */
function bindRefreshPersistence(): void {
  if (refreshListenerBound) return;
  try {
    getHubDbClient().auth.onAuthStateChange((event, session) => {
      if (event !== 'TOKEN_REFRESHED' || !session?.refresh_token) return;
      saveHubRefreshToken(session.refresh_token);
    });
    refreshListenerBound = true;
  } catch (error) {
    console.warn('[HubSession] No se pudo enganchar la renovacion de sesion:', describe(error));
  }
}

/**
 * Aplica al cliente del Hub la sesion que publico el renderer y la persiste.
 * Nunca lanza: un fallo deja a main como `anon`, que es el estado seguro.
 */
export async function applyHubSession(
  tokens: HubSessionTokens,
  userId: string | null,
): Promise<HubSessionResult> {
  const accessToken = String(tokens.accessToken || '').trim();
  const refreshToken = String(tokens.refreshToken || '').trim();
  if (!accessToken || !refreshToken) return 'sin-sesion';

  try {
    const client = getHubDbClient();
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.warn('[HubSession] El servidor rechazo la sesion publicada:', error.message);
      return 'rechazada';
    }

    currentUserId = data.session?.user?.id ?? userId ?? null;
    bindRefreshPersistence();
    // Se guarda el token vigente tras `setSession`: puede haberse renovado ya.
    saveHubRefreshToken(data.session?.refresh_token || refreshToken);
    console.log('[HubSession] Sesion aplicada: main opera con la identidad del usuario.');
    return 'aplicada';
  } catch (error) {
    // Sin credenciales de la base configuradas, main sigue como `anon`.
    console.warn('[HubSession] No se pudo aplicar la sesion:', describe(error));
    return 'no-disponible';
  }
}

/**
 * Restaura la sesion guardada. Debe llamarse ANTES de inicializar los servicios:
 * el planificador levanta sus cron en el arranque y, sin identidad, cargaria
 * como `anon` y no encontraria las reglas del usuario.
 */
export async function restoreHubSession(): Promise<HubSessionResult> {
  if (!hasStoredHubSession()) return 'sin-sesion';

  const refreshToken = readHubRefreshToken();
  if (!refreshToken) return 'sin-sesion';

  try {
    const client = getHubDbClient();
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      // Token caducado, revocado o de otra instancia: se descarta y se arranca
      // sin sesion. Conservarlo solo produciria un fallo por consulta.
      console.warn('[HubSession] La sesion guardada ya no es valida; se descarta.');
      clearHubRefreshToken();
      currentUserId = null;
      return 'rechazada';
    }

    currentUserId = data.session.user?.id ?? null;
    bindRefreshPersistence();
    saveHubRefreshToken(data.session.refresh_token);
    console.log('[HubSession] Sesion restaurada: los agentes de canal operan con identidad.');
    return 'aplicada';
  } catch (error) {
    console.warn('[HubSession] No se pudo restaurar la sesion:', describe(error));
    return 'no-disponible';
  }
}

/** Borra la credencial y devuelve a main a cliente anonimo. */
export async function revokeHubSession(): Promise<void> {
  clearHubRefreshToken();
  currentUserId = null;
  try {
    // `scope: 'local'` cierra solo esta sesion del cliente: cerrar sesion en el
    // escritorio no debe echar al usuario de sus otros dispositivos.
    await getHubDbClient().auth.signOut({ scope: 'local' });
    console.log('[HubSession] Sesion revocada: main vuelve a operar como anonimo.');
  } catch (error) {
    console.warn('[HubSession] No se pudo cerrar la sesion del cliente:', describe(error));
  }
}

/** Solo para pruebas. */
export function resetHubSessionForTests(): void {
  currentUserId = null;
  refreshListenerBound = false;
}

/** Mensaje de error sin arrastrar el objeto entero a la traza. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
