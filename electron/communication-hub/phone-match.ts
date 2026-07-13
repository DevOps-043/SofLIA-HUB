/**
 * Ranking de usuarios SOFIA por coincidencia telefonica.
 *
 * Varios registros de `users` pueden compartir el mismo telefono (duplicados
 * historicos de la migracion de auth). El orden importa: primero coincidencias
 * exactas del numero normalizado y despues coincidencias por sufijo, para que
 * el resolutor de principal evalue los candidatos mas confiables primero.
 */

import { normalizePhone } from '../iris/phone';

export function rankUsersByPhoneMatch<T extends { phone?: string | null }>(
  users: T[],
  normalizedPhone: string,
): T[] {
  if (!normalizedPhone) return [];
  const exactMatches: T[] = [];
  const suffixMatches: T[] = [];
  for (const user of users) {
    const userPhone = normalizePhone(user.phone || '');
    if (!userPhone) continue;
    if (userPhone === normalizedPhone) {
      exactMatches.push(user);
    } else if (userPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(userPhone)) {
      suffixMatches.push(user);
    }
  }
  return [...exactMatches, ...suffixMatches];
}
