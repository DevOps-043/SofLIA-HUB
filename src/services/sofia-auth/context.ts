import type { SofiaAuthUser, SofiaContext } from './types';
import type { SofiaUserProfile } from '../../lib/sofia-client';

export function buildActiveSofiaContext(sofiaProfile: SofiaUserProfile | null): SofiaContext {
  const activeMemberships = sofiaProfile?.memberships?.filter((membership) => membership.status === 'active') || [];
  const suspendedMemberships = sofiaProfile?.memberships?.filter((membership) => membership.status === 'suspended') || [];

  if (activeMemberships.length === 0) {
    if (suspendedMemberships.length > 0) {
      throw new Error('Acceso denegado: Tu cuenta ha sido suspendida por el administrador.');
    }
    throw new Error('Acceso denegado: No tienes una membresia activa en ninguna organizacion.');
  }

  const activeOrgs = sofiaProfile?.organizations?.filter((org) =>
    activeMemberships.some((membership) => membership.organization_id === org.id)
  ) || [];
  const activeTeams = sofiaProfile?.teams?.filter((team) =>
    activeMemberships.some((membership) => membership.team_id === team.id)
  ) || [];

  return {
    user: sofiaProfile,
    currentOrganization: activeOrgs[0] || null,
    currentTeam: activeTeams[0] || null,
    organizations: activeOrgs,
    teams: activeTeams,
    memberships: activeMemberships,
  };
}

export function createPseudoAuthUser(sofiaUser: any, avatarUrl: string | null): SofiaAuthUser {
  return {
    id: sofiaUser.id,
    email: sofiaUser.email,
    user_metadata: {
      first_name: sofiaUser.first_name,
      last_name: sofiaUser.last_name,
      avatar_url: avatarUrl || undefined,
    },
  };
}
