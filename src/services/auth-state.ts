// Wrapper tipado del renderer para publicar el estado de sesion al proceso main.
//
// El main niega por defecto las funciones sensibles (orbe, deteccion de
// reuniones, etc.) hasta recibir `authenticated: true`. Publicar es obligatorio
// tras iniciar sesion, cerrarla y restaurarla.

export interface AuthStatePayload {
  authenticated: boolean;
  userId: string | null;
}

/**
 * Lo que se publica al main: el estado observable más los tokens de la sesión.
 *
 * Los tokens son de ida: el main los necesita para operar ante la base con la
 * identidad del usuario —sin ellos su rol es anónimo y las políticas por usuario
 * le devuelven cero filas—, pero nunca vuelven por ningún canal. `getState` sigue
 * devolviendo solo `AuthStatePayload`.
 */
export interface AuthStatePublication extends AuthStatePayload {
  accessToken?: string | null;
  refreshToken?: string | null;
  sofiaAccessToken?: string | null;
}

interface AuthStateBridge {
  setState: (state: AuthStatePublication) => Promise<{ ok: boolean; state: AuthStatePayload }>;
  getState: () => Promise<AuthStatePayload>;
}

function getBridge(): AuthStateBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { authState?: AuthStateBridge }).authState ?? null;
}

/**
 * La ventana orbe consume el gate pero NO es fuente de verdad del estado: si
 * publicara, su carga inicial emitiria un `authenticated: false` transitorio que
 * revocaria la sesion y la cerraria a si misma.
 */
export function isOrbWindowRenderer(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.href.includes('view=orb')) return true;
  const argv = (window as Window & { process?: { argv?: unknown } }).process?.argv;
  return Array.isArray(argv) && argv.includes('--view-mode=orb');
}

/**
 * Publica el estado de sesion en el proceso main. No lanza: fuera de Electron o
 * si el puente no existe, simplemente no hay gate que actualizar.
 */
export async function publishAuthState(state: AuthStatePublication): Promise<void> {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.setState(state);
  } catch (error) {
    // No se registra el estado publicado: llevaría los tokens al log del renderer.
    console.warn('[Auth] No se pudo publicar el estado de sesion al proceso main.');
    void error;
  }
}
