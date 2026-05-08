import { useEffect, useState } from 'react';
import { orgService, type OrgMember } from '../../services/org-service';
import type { SofiaOrganization } from '../../lib/sofia-client';
import type { MemberStatus, OrganizationRole } from './types';

export function useOrganizationMembers(isOpen: boolean, organization: SofiaOrganization | null, isAdmin: boolean) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const fetchMembers = async () => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    try {
      setMembers(await orgService.getOrganizationMembers(organization.id));
    } catch {
      setError('Error al cargar miembros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && organization) void fetchMembers();
  }, [isOpen, organization]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      await orgService.inviteUser(organization.id, inviteEmail.trim(), inviteRole);
      setSuccess(`Invitacion enviada a ${inviteEmail}`);
      setInviteEmail('');
      void fetchMembers();
    } catch (err: any) {
      setError(err.message || 'Error al invitar');
    } finally {
      setInviting(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: OrganizationRole) => {
    try {
      await orgService.updateMemberRole(membershipId, newRole);
      setMembers(prev => prev.map(member => member.id === membershipId ? { ...member, role: newRole } : member));
    } catch {
      alert('Error al actualizar rol');
    }
  };

  const handleStatusChange = async (membershipId: string, newStatus: MemberStatus) => {
    if (!isAdmin || (newStatus === 'removed' && !confirm('Eliminar miembro permanentemente?'))) return;
    try {
      await orgService.updateMemberStatus(membershipId, newStatus);
      setMembers(prev => newStatus === 'removed'
        ? prev.filter(member => member.id !== membershipId)
        : prev.map(member => member.id === membershipId ? { ...member, status: newStatus } : member));
    } catch {
      alert('Error al actualizar estado');
    }
  };

  return {
    members,
    loading,
    inviteEmail,
    inviteRole,
    error,
    success,
    inviting,
    setInviteEmail,
    setInviteRole,
    fetchMembers,
    handleInvite,
    handleRoleChange,
    handleStatusChange,
  };
}
