// Wrapper tipado del renderer para publicar el estado de sesion al proceso main.
//
// El main niega por defecto las funciones sensibles (orbe, deteccion de
// reuniones, etc.) hasta recibir `authenticated: true`. Publicar es obligatorio
// tras iniciar sesion, cerrarla y restaurarla.

import type { AuthStateBridge, AuthStatePublication } from '../shared/auth-state';
export type { AuthStatePayload, AuthStatePublication } from '../shared/auth-state';

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
type PublicationSource = AuthStatePublication | (() => Promise<AuthStatePublication | null>);
let pendingPublication: Promise<void> = Promise.resolve();
const PUBLICATION_WAIT_MS = 10_000;

export function publishAuthState(source: PublicationSource): Promise<boolean | 'revoked'> {
  const publication = sendAuthState(source);
  pendingPublication = Promise.all([pendingPublication, publication]).then(() => undefined);
  return publication;
}

async function sendAuthState(source: PublicationSource): Promise<boolean | 'revoked'> {
  const bridge = getBridge();
  if (!bridge) return true;
  try {
    const state = typeof source === 'function' ? await source() : source;
    if (!state) return true;
    const response = await bridge.setState(state);
    if (!response.ok) {
      const reason = response.reason === 'invalid_payload' || response.reason === 'sofia_unverified' || response.reason === 'sofia_revoked'
        ? response.reason : undefined;
      if (reason) console.warn('[Auth] El proceso main rechazó la publicación de sesión.', reason);
      else console.warn('[Auth] El proceso main rechazó la publicación de sesión.');
    }
    return !response.ok && response.reason === 'sofia_revoked' ? 'revoked' : response.ok;
  } catch {
    // No se registra el estado publicado: llevaría los tokens al log del renderer.
    console.warn('[Auth] No se pudo publicar el estado de sesion al proceso main.');
    return false;
  }
}

/** Espera sólo publicaciones existentes; la autorización sigue en main. */
export async function waitForAuthStatePublication(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = async () => {
    let observed: Promise<void>;
    do {
      observed = pendingPublication;
      await observed;
    } while (observed !== pendingPublication);
    return true;
  };
  try {
    return await Promise.race([
      settled(),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), PUBLICATION_WAIT_MS); }),
    ]);
  } finally { clearTimeout(timer); }
}
