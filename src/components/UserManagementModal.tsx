import { InvitationCard } from './user-management-modal/InvitationCard';
import { MembersList } from './user-management-modal/MembersList';
import { UserManagementFooter } from './user-management-modal/UserManagementFooter';
import { UserManagementHeader } from './user-management-modal/UserManagementHeader';
import type { UserManagementModalProps } from './user-management-modal/types';
import { useOrganizationMembers } from './user-management-modal/useOrganizationMembers';

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  organization,
  currentUserRole,
  embedded = false,
}) => {
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const membersState = useOrganizationMembers(isOpen, organization, isAdmin);

  if (!isOpen && !embedded) return null;

  const content = (
    <div
      className={`flex flex-col overflow-hidden relative ${embedded ? 'w-full h-full' : 'w-full max-w-180 max-h-[85vh] bg-background rounded-3xl border border-border shadow-2xl animate-fade-in'}`}
      onClick={event => event.stopPropagation()}
    >
      {!embedded && <UserManagementHeader organization={organization} onClose={onClose} />}

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 relative z-10">
        {isAdmin && (
          <InvitationCard
            inviteEmail={membersState.inviteEmail}
            inviteRole={membersState.inviteRole}
            inviting={membersState.inviting}
            error={membersState.error}
            success={membersState.success}
            onEmailChange={membersState.setInviteEmail}
            onRoleChange={membersState.setInviteRole}
            onSubmit={membersState.handleInvite}
          />
        )}

        <MembersList
          members={membersState.members}
          loading={membersState.loading}
          isAdmin={isAdmin}
          onRefresh={membersState.fetchMembers}
          onRoleChange={membersState.handleRoleChange}
          onStatusChange={membersState.handleStatusChange}
        />
      </div>

      {!embedded && <UserManagementFooter onClose={onClose} />}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      {content}
    </div>
  );
};
