import type { SofiaOrganizationUser, SofiaUser } from '../../lib/sofia-client';

export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgMemberStatus = 'active' | 'suspended' | 'removed';

export interface OrgMember extends SofiaOrganizationUser {
  user_profile?: SofiaUser;
}
