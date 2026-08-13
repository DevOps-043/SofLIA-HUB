/**
 * Registro durable de conversaciones borradas ("lapidas").
 *
 * La cola `pending-state` no sirve para esto: su entrada de borrado se limpia en
 * cuanto el borrado remoto se considera hecho, y a partir de ese momento nada
 * impide que la conversacion vuelva a aparecer si sobrevive en Supabase o en el
 * cache de otra identidad. Estas lapidas persisten despues del sync y son la
 * ultima linea de defensa: una conversacion borrada por el usuario no se vuelve
 * a listar, no se vuelve a cachear y no se vuelve a subir nunca.
 *
 * Se guardan por usuario, acotadas en FIFO para no crecer sin limite, y se
 * escriben para TODAS las identidades locales: la misma persona puede tener
 * cache bajo su id de SOFIA y bajo su id de LIA.
 */

import { CACHE_KEYS, getDeletedConversationsKey } from './cache';

const MAX_TOMBSTONES = 500;

function readTombstones(userId: string): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getDeletedConversationsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed) ? parsed : parsed?.ids;
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)));
  } catch {
    return [];
  }
}

function writeTombstones(userId: string, ids: string[]): void {
  try {
    const bounded = ids.slice(-MAX_TOMBSTONES);
    if (bounded.length === 0) {
      localStorage.removeItem(getDeletedConversationsKey(userId));
      return;
    }
    localStorage.setItem(getDeletedConversationsKey(userId), JSON.stringify({ ids: bounded }));
  } catch {
    // Degradacion silenciosa: sin lapida el borrado sigue siendo remoto, solo
    // se pierde la proteccion local contra reapariciones.
  }
}

export function getConversationTombstones(userId: string): Set<string> {
  return new Set(readTombstones(userId));
}

export function isConversationTombstoned(userId: string, conversationId: string): boolean {
  if (!userId || !conversationId) return false;
  return readTombstones(userId).includes(conversationId);
}

export function recordConversationTombstone(userId: string, conversationId: string): void {
  if (!userId || !conversationId) return;
  const current = readTombstones(userId);
  if (current.includes(conversationId)) return;
  writeTombstones(userId, [...current, conversationId]);
}

/**
 * Marca el borrado en la identidad activa y en cualquier otra que tenga cache
 * local: al cambiar de identidad (SOFIA -> LIA) la migracion de cache no debe
 * poder revivir lo que el usuario ya borro.
 */
export function recordConversationTombstoneForAllIdentities(activeUserId: string, conversationId: string): void {
  if (!conversationId) return;
  const identities = new Set<string>();
  if (activeUserId) identities.add(activeUserId);

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(CACHE_KEYS.CONVERSATIONS_PREFIX)) {
        identities.add(key.slice(CACHE_KEYS.CONVERSATIONS_PREFIX.length));
      } else if (key.startsWith(CACHE_KEYS.PENDING_PREFIX)) {
        identities.add(key.slice(CACHE_KEYS.PENDING_PREFIX.length));
      }
    }
  } catch {
    // Sin recorrido de storage al menos queda la identidad activa marcada.
  }

  for (const identity of identities) {
    if (identity) recordConversationTombstone(identity, conversationId);
  }
}
