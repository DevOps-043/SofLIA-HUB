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
  /** Selección de UI; main comprueba membresía antes de usarla. */
  organizationId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  sofiaAccessToken?: string | null;
  sofiaRefreshToken?: string | null;
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
type PublicationSource = AuthStatePublication | (() => Promise<AuthStatePublication | null>);
let pendingPublication: Promise<void> = Promise.resolve();
const PUBLICATION_WAIT_MS = 10_000;

export function publishAuthState(source: PublicationSource): Promise<void> {
  // Reservar antes de obtener SOFIA: las vistas hijas pueden consultar mientras
  // ese SDK todavía está restaurando el token. Las publicaciones no se encolan:
  // cerrar sesión debe revocar main inmediatamente aunque otra siga pendiente.
  const publication = (async () => {
    const bridge = getBridge();
    if (!bridge) return;
    const state = typeof source === 'function' ? await source() : source;
    if (state) await bridge.setState(state);
  })().catch(() => {
    // Nunca registrar el payload: contiene credenciales.
    console.warn('[Auth] No se pudo publicar el estado de sesion al proceso main.');
  });
  pendingPublication = Promise.all([pendingPublication, publication]).then(() => undefined);
  return publication;
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
