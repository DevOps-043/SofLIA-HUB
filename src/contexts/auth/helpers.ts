import type { User } from '@supabase/supabase-js';
import type { SofiaAuthUser, SofiaContext } from '../../services/sofia-auth';
import type { SofiaUserProfile } from '../../lib/sofia-client';
import { pickInitialOrganization } from '../../services/sofia-auth/org-preference';

export const LIA_RESTORE_MESSAGE =
  'No hay una sesion activa de Lia en este dispositivo. Cierra sesion e inicia de nuevo para reactivar la sincronizacion de conversaciones.';

// Se usa cuando SOFIA no responde al restaurar la sesion: la sesion se conserva
// y la app queda degradada (sin organizacion/equipos) en vez de cerrar sesion.
export const SOFIA_CONTEXT_DEGRADED_MESSAGE =
  'No se pudo cargar tu organizacion en este momento. Tu sesion sigue activa; se reintentara automaticamente.';

export function toAuthUser(user: User, userMetadata?: SofiaAuthUser['user_metadata']): SofiaAuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: userMetadata ?? user.user_metadata,
  };
}

export function buildSofiaContext(profile: SofiaUserProfile | null | undefined): SofiaContext | null {
  const activeMemberships = profile?.memberships?.filter((membership) => membership.status === 'active') || [];
  if (activeMemberships.length === 0) return null;

  const activeOrgs = profile?.organizations?.filter((organization) =>
    activeMemberships.some((membership) => membership.organization_id === organization.id),
  ) || [];
  const activeTeams = profile?.teams?.filter((team) =>
    activeMemberships.some((membership) => membership.team_id === team.id),
  ) || [];

  const currentOrganization = pickInitialOrganization(profile?.id, activeOrgs);
  const currentTeam = currentOrganization
    ? activeTeams.find((team) => team.organization_id === currentOrganization.id) || null
    : activeTeams[0] || null;

  return {
    user: profile ?? null,
    currentOrganization,
    currentTeam,
    organizations: activeOrgs,
    teams: activeTeams,
    memberships: activeMemberships,
  };
}

export function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}
