// Wrapper tipado del renderer para publicar el estado de sesion al proceso main.
//
// El main niega por defecto las funciones sensibles (orbe, deteccion de
// reuniones, etc.) hasta recibir `authenticated: true`. Publicar es obligatorio
// tras iniciar sesion, cerrarla y restaurarla.

export interface AuthStatePayload {
  authenticated: boolean;
  userId: string | null;
}

interface AuthStateBridge {
  setState: (state: AuthStatePayload) => Promise<{ ok: boolean; state: AuthStatePayload }>;
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
export async function publishAuthState(state: AuthStatePayload): Promise<void> {
  const bridge = getBridge();
  if (!bridge) return;
  try {
    await bridge.setState(state);
  } catch (error) {
    console.warn('[Auth] No se pudo publicar el estado de sesion al proceso main:', error);
  }
}
