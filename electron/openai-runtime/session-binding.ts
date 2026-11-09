import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { getHubSessionUserId } from '../main/hub-session';

let binding: { mainUserId: string; hubUserId: string } | null = null;
let unsubscribe: (() => void) | undefined;

/** Recibo sólo de una publicación nativa aceptada; no presupone igualdad SOFIA/Lia. */
export function bindOpenAIHubSession(mainUserId: string | null): void {
  const state = getAuthState(), hubUserId = getHubSessionUserId();
  if (!mainUserId || !state.authenticated || state.userId !== mainUserId || !hubUserId) return;
  unsubscribe?.();
  binding = { mainUserId, hubUserId };
  unsubscribe = onAuthStateChange(() => { binding = null; unsubscribe?.(); unsubscribe = undefined; });
}

/** Una sesión Lia anterior al cambio main no autoriza consultar sus credenciales. */
export function linkedOpenAIHubUserId(): string | null {
  const hubUserId = getHubSessionUserId();
  if (!hubUserId) return null;
  const state = getAuthState();
  if (!state.authenticated || !binding || binding.mainUserId !== state.userId || binding.hubUserId !== hubUserId) throw new Error('La sesión Lia aún no está vinculada a esta identidad main.');
  return hubUserId;
}
