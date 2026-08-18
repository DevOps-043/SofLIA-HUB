/**
 * Scope canonico de la memoria por *owner* (dueño).
 *
 * Toda superficie (chat de la app, WhatsApp, tareas de escritorio,
 * investigaciones) resuelve un `ownerKey` estable para que compartan la MISMA
 * memoria del usuario. La forma preferida es `user:<sofiaUserId>` (unifica entre
 * superficies); si no se puede identificar al usuario, se cae a un scope aislado
 * por telefono (`phone:<numero>`) o al owner local del equipo (`local:owner`),
 * sin mezclar nunca datos de distintos dueños.
 *
 * Este modulo es PURO/testeable: los builders de clave no dependen de Electron;
 * la resolucion async recibe su dependencia (resolver de userId) por inyeccion.
 */

export type OwnerKind = 'user' | 'phone' | 'local';

/** Owner del equipo cuando no hay sesion de usuario identificada. */
export const LOCAL_OWNER_KEY = 'local:owner';

/** Clave de owner a partir del userId de SOFIA (la forma que unifica superficies). */
export function userOwnerKey(userId: string): string {
  const clean = String(userId ?? '').trim();
  return clean ? `user:${clean}` : LOCAL_OWNER_KEY;
}

/** Clave de owner aislada por telefono (fallback cuando no hay userId). */
export function phoneOwnerKey(phone: string): string {
  const clean = normalizePhone(phone);
  return clean ? `phone:${clean}` : LOCAL_OWNER_KEY;
}

export function ownerKind(ownerKey: string): OwnerKind {
  if (ownerKey.startsWith('user:')) return 'user';
  if (ownerKey.startsWith('phone:')) return 'phone';
  return 'local';
}

export function isValidOwnerKey(value: unknown): value is string {
  return typeof value === 'string' && /^(user:|phone:|local:)/.test(value);
}

/**
 * Clave con la que se guardan y leen los HECHOS (tabla `facts`, columna
 * `phone_number`, heredada de WhatsApp).
 *
 * `assembleContext` lee los hechos con el mismo valor que recibe como
 * `phoneNumber`: el telefono en WhatsApp y el `ownerKey` en el chat de la app y
 * en las tareas de escritorio. Escribirlos con otra clave (por ejemplo el id
 * suelto que queda al partir `chat:user:<id>`) los deja huerfanos: se guardan y
 * nunca se vuelven a leer. Esta funcion define esa clave en un solo lugar.
 */
export function factsScopeKey(ownerKey: string): string {
  if (ownerKind(ownerKey) === 'phone') return ownerKey.slice('phone:'.length);
  return ownerKey;
}

/**
 * Resuelve el ownerKey para una interaccion de WhatsApp: intenta mapear el
 * telefono a un userId de SOFIA (unifica con el chat de la app); si falla, usa
 * el scope por telefono. El resolver de userId se inyecta para no acoplar este
 * modulo a la capa de datos ni a Electron.
 */
export async function resolveWhatsAppOwnerKey(
  phone: string,
  resolveUserId: (phone: string) => Promise<string | null>,
): Promise<string> {
  try {
    const userId = await resolveUserId(phone);
    if (userId && userId.trim()) return userOwnerKey(userId);
  } catch {
    // Cae al scope por telefono.
  }
  return phoneOwnerKey(phone);
}

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/[^\d]/g, '');
}
