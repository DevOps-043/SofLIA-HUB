import {
  getOrganizationMembers,
  inviteUser,
  updateMemberRole,
  updateMemberStatus,
} from './org/operations';
import type { OrgMember, OrgMemberStatus, OrgRole } from './org/types';

class OrgService {
  getOrganizationMembers(organizationId: string): Promise<OrgMember[]> {
    return getOrganizationMembers(organizationId);
  }

  updateMemberRole(membershipId: string, role: OrgRole): Promise<void> {
    return updateMemberRole(membershipId, role);
  }

  updateMemberStatus(membershipId: string, status: OrgMemberStatus): Promise<void> {
    return updateMemberStatus(membershipId, status);
  }

  inviteUser(
    organizationId: string,
    identifier: string,
    role: Exclude<OrgRole, 'owner'> = 'member',
  ): Promise<void> {
    return inviteUser(organizationId, identifier, role);
  }
}

export type { OrgMember, OrgMemberStatus, OrgRole };
export const orgService = new OrgService();
