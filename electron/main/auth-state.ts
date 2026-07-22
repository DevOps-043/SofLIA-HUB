// Estado de autenticacion conocido por el proceso main.
//
// El renderer es el dueno de la sesion (SOFIA/Supabase); el main solo mantiene
// una copia minima para poder NEGAR POR DEFECTO las funciones sensibles (orbe,
// WhatsApp, deteccion de reuniones, computer-use, desktop-agent) mientras no
// haya sesion valida.
//
// Valor inicial: NO autenticado. Antes de recibir el primer `auth:set-state` el
// main asume que no hay sesion, de modo que un arranque nunca expone funciones.
// No se guardan tokens ni datos personales: solo el identificador de usuario.

export interface MainAuthState {
  authenticated: boolean;
  userId: string | null;
}

type AuthStateListener = (state: MainAuthState) => void;

let currentState: MainAuthState = { authenticated: false, userId: null };
const listeners = new Set<AuthStateListener>();

export function getAuthState(): MainAuthState {
  return { ...currentState };
}

export function isAuthenticated(): boolean {
  return currentState.authenticated;
}

/** Actualiza el estado y notifica a los suscriptores solo si cambio. */
export function setAuthState(next: MainAuthState): MainAuthState {
  const normalized: MainAuthState = {
    authenticated: next.authenticated === true,
    userId: next.authenticated === true && typeof next.userId === 'string' && next.userId ? next.userId : null,
  };

  const changed =
    normalized.authenticated !== currentState.authenticated || normalized.userId !== currentState.userId;
  currentState = normalized;

  if (changed) {
    console.log(`[AUTH] Estado actualizado: autenticado=${normalized.authenticated}`);
    for (const listener of listeners) {
      try {
        listener(getAuthState());
      } catch (error) {
        console.error('[AUTH] Un suscriptor de estado fallo:', error);
      }
    }
  }

  return getAuthState();
}

/** Suscribe cambios de estado; devuelve la funcion para desuscribir. */
export function onAuthStateChange(listener: AuthStateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Solo para pruebas: restablece el estado inicial negado. */
export function resetAuthStateForTests(): void {
  currentState = { authenticated: false, userId: null };
  listeners.clear();
}
