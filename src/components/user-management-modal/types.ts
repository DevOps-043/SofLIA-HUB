import type { OrgMember } from '../../services/org-service';
import type { SofiaOrganization } from '../../lib/sofia-client';

export type OrganizationRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'suspended' | 'removed';

export interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: SofiaOrganization | null;
  currentUserRole: OrganizationRole;
  embedded?: boolean;
}

export type MembersStateActions = {
  onRefresh: () => void;
  onRoleChange: (membershipId: string, newRole: OrganizationRole) => void;
  onStatusChange: (membershipId: string, newStatus: MemberStatus) => void;
};

export type MemberRowProps = Omit<MembersStateActions, 'onRefresh'> & {
  member: OrgMember;
  isAdmin: boolean;
};
