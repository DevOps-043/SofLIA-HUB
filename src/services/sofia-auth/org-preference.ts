import type { SofiaOrganization } from '../../lib/sofia-client';

/**
 * Persistencia de la organizacion activa elegida por el usuario.
 * Se guarda por usuario para que al reiniciar la app se restaure su ultima seleccion.
 */
const ORG_PREF_PREFIX = 'sofia-current-org:';

function keyFor(userId: string): string {
  return `${ORG_PREF_PREFIX}${userId}`;
}

export function getPreferredOrgId(userId: string | null | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

export function savePreferredOrgId(userId: string | null | undefined, orgId: string): void {
  if (!userId || !orgId) return;
  try {
    localStorage.setItem(keyFor(userId), orgId);
  } catch {
    /* localStorage no disponible; ignorar */
  }
}

/**
 * Elige la organizacion inicial: la ultima guardada si sigue activa, o la primera activa.
 */
export function pickInitialOrganization(
  userId: string | null | undefined,
  activeOrgs: SofiaOrganization[],
): SofiaOrganization | null {
  if (activeOrgs.length === 0) return null;
  const preferredId = getPreferredOrgId(userId);
  const preferred = preferredId ? activeOrgs.find((org) => org.id === preferredId) : null;
  return preferred || activeOrgs[0];
}
