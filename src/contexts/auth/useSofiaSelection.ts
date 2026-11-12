import { sofiaAuth, type SofiaContext } from '../../services/sofia-auth';
import { savePreferredOrgId } from '../../services/sofia-auth/org-preference';
import { mergeOrganizationProfile } from '../../services/org/settings-context';
import type { SofiaOrganization } from '../../lib/sofia-client';

type SofiaSelectionDeps = {
  setSofiaContext: (updater: (prev: SofiaContext | null) => SofiaContext | null) => void;
  sofiaContext: SofiaContext | null;
};

export function useSofiaSelection({ setSofiaContext, sofiaContext }: SofiaSelectionDeps) {
  const setCurrentOrganization = (orgId: string) => {
    const organization = sofiaContext?.organizations.find((org) => org.id === orgId);
    if (!organization) return;
    sofiaAuth.setCurrentOrganization(organization);
    savePreferredOrgId(sofiaContext?.user?.id, organization.id);
    setSofiaContext((prev) => prev ? {
      ...prev,
      currentOrganization: organization,
      currentTeam: prev.teams.find((team) => team.organization_id === organization.id) || null,
    } : null);
  };

  const setCurrentTeam = (teamId: string) => {
    const team = sofiaContext?.teams.find((item) => item.id === teamId);
    if (!team) return;
    sofiaAuth.setCurrentTeam(team);
    setSofiaContext((prev) => prev ? { ...prev, currentTeam: team } : null);
  };

  const updateOrganizationProfile = (organization: SofiaOrganization, actorId: string) => {
    sofiaAuth.updateOrganizationProfile(organization, actorId);
    setSofiaContext(previous => mergeOrganizationProfile(previous, organization, actorId));
  };

  return { setCurrentOrganization, setCurrentTeam, updateOrganizationProfile };
}
