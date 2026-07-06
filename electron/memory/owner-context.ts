import { userOwnerKey, LOCAL_OWNER_KEY } from './scope';

/**
 * Registro del OWNER actual del equipo (usuario SOFIA con sesión iniciada).
 *
 * Motivación: superficies del proceso main sin identidad propia (agente de
 * escritorio, jobs) necesitan saber a qué usuario pertenece la actividad para
 * escribir en la MISMA memoria que el chat/WhatsApp. El renderer fija este valor
 * al iniciar sesión; si no hay sesión, se usa el owner local del equipo.
 *
 * Estado en memoria por proceso (no persiste); es el "usuario activo ahora".
 */

let currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null): void {
  const clean = typeof userId === 'string' ? userId.trim() : '';
  currentUserId = clean || null;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

/** OwnerKey del usuario activo (`user:<id>`) o el owner local si no hay sesión. */
export function getCurrentOwnerKey(): string {
  return currentUserId ? userOwnerKey(currentUserId) : LOCAL_OWNER_KEY;
}
