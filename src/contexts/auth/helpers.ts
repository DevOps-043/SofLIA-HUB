import type { User } from '@supabase/supabase-js';
import type { SofiaAuthUser, SofiaContext } from '../../services/sofia-auth';
import { pickInitialOrganization } from '../../services/sofia-auth/org-preference';

export const LIA_RESTORE_MESSAGE =
  'No hay una sesion activa de Lia en este dispositivo. Cierra sesion e inicia de nuevo para reactivar la sincronizacion de conversaciones.';

export function toAuthUser(user: User, userMetadata?: SofiaAuthUser['user_metadata']): SofiaAuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: userMetadata ?? user.user_metadata,
  };
}

export function buildSofiaContext(profile: any): SofiaContext | null {
  const activeMemberships = profile?.memberships?.filter((membership: any) => membership.status === 'active') || [];
  if (activeMemberships.length === 0) return null;

  const activeOrgs = profile?.organizations?.filter((organization: any) =>
    activeMemberships.some((membership: any) => membership.organization_id === organization.id),
  ) || [];
  const activeTeams = profile?.teams?.filter((team: any) =>
    activeMemberships.some((membership: any) => membership.team_id === team.id),
  ) || [];

  const currentOrganization = pickInitialOrganization(profile?.id, activeOrgs);
  const currentTeam = currentOrganization
    ? activeTeams.find((team: any) => team.organization_id === currentOrganization.id) || null
    : activeTeams[0] || null;

  return {
    user: profile,
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
