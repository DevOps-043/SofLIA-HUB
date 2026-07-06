import { getWhatsAppSession } from '../iris-data-main';
import { phoneOwnerKey, userOwnerKey } from '../memory/scope';

/**
 * Resuelve el ownerKey de memoria para una interacción de WhatsApp: si el número
 * está ligado a un usuario de SOFIA (sesión activa), usa `user:<id>` para
 * UNIFICAR con el chat de la app y las tareas de escritorio; si no, cae al scope
 * aislado por teléfono. Síncrono (lee la sesión ya cargada), sin efectos.
 *
 * En GRUPOS se prefiere no unificar (evita meter conversación grupal en la
 * memoria personal): el llamador pasa `isGroup` para forzar el scope por sesión.
 */
export function resolveWhatsAppOwnerKey(phone: string, isGroup = false): string {
  if (isGroup) return phoneOwnerKey(phone);
  try {
    const userId = getWhatsAppSession(phone)?.userId;
    if (userId) return userOwnerKey(userId);
  } catch {
    // fallback abajo
  }
  return phoneOwnerKey(phone);
}
