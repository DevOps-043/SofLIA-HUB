// Guard central de negacion por defecto.
//
// Se aplica en la capacidad, no en cada punto de entrada: al gatear
// `createOrbWindow` quedan cubiertos wake word, atajo global y tray con una sola
// comprobacion. Sin sesion valida la operacion no produce efectos.
//
// Rollback: SOFLIA_DISABLE_AUTH_GATE=1 restablece el comportamiento previo (sin
// gate en el main) para una reversion controlada.

import { isAuthenticated } from './auth-state';

export const AUTH_REQUIRED = 'auth_required';

export interface AuthDeniedResult {
  ok: false;
  error: typeof AUTH_REQUIRED;
  message: string;
}

function isGateDisabled(): boolean {
  return process.env.SOFLIA_DISABLE_AUTH_GATE === '1';
}

/** True si la capacidad puede ejecutarse (hay sesion o el gate esta desactivado). */
export function canUseProtectedFeature(): boolean {
  return isGateDisabled() || isAuthenticated();
}

/**
 * Registra y construye la respuesta de denegacion para una capacidad protegida.
 * Devuelve null cuando la operacion SI puede continuar.
 */
export function denyIfUnauthenticated(capacidad: string): AuthDeniedResult | null {
  if (canUseProtectedFeature()) return null;
  console.warn(`[AUTH] Acceso denegado a "${capacidad}": no hay sesion iniciada.`);
  return {
    ok: false,
    error: AUTH_REQUIRED,
    message: 'Inicia sesion en SofLIA Hub para usar esta funcion.',
  };
}
