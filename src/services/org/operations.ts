import { sofiaSupa } from '../../lib/sofia-client';
import type { OrgMember, OrgMemberStatus, OrgRole } from './types';

export async function getOrganizationMembers(organizationId: string): Promise<OrgMember[]> {
  console.log('[OrgService] Fetching members for org:', organizationId);
  if (!sofiaSupa) {
    console.warn('[OrgService] sofiaSupa is not initialized');
    return [];
  }

  try {
    const { data, error } = await sofiaSupa
      .from('organization_users')
      .select(`
        *,
        user_profile:users!user_id (*)
      `)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[OrgService] Supabase error fetching members:', error);
      throw error;
    }

    console.log(`[OrgService] Found ${data?.length || 0} members`);

    return (data || []).map((member: any) => ({
      ...member,
      user_profile: member.user_profile || null,
    }));
  } catch (err) {
    console.error('[OrgService] Exception in getOrganizationMembers:', err);
    throw err;
  }
}

export async function updateMemberRole(membershipId: string, role: OrgRole): Promise<void> {
  if (!sofiaSupa) return;

  const { error } = await sofiaSupa
    .from('organization_users')
    .update({ role })
    .eq('id', membershipId);

  if (error) {
    console.error('Error updating member role:', error);
    throw error;
  }
}

export async function updateMemberStatus(
  membershipId: string,
  status: OrgMemberStatus,
): Promise<void> {
  if (!sofiaSupa) return;

  const { error } = await sofiaSupa
    .from('organization_users')
    .update({ status })
    .eq('id', membershipId);

  if (error) {
    console.error('Error updating member status:', error);
    throw error;
  }
}

export async function inviteUser(
  organizationId: string,
  identifier: string,
  role: Exclude<OrgRole, 'owner'> = 'member',
): Promise<void> {
  if (!sofiaSupa) return;

  const { data: user, error: userError } = await sofiaSupa
    .from('users')
    .select('id')
    .or(`email.eq.${identifier},username.eq.${identifier}`)
    .single();

  if (userError || !user) {
    throw new Error('Usuario no encontrado en SOFIA. Asegurate de que el email o username sea correcto.');
  }

  const { error: inviteError } = await sofiaSupa
    .from('organization_users')
    .insert({ organization_id: organizationId, user_id: user.id, role, status: 'active' });

  if (inviteError) {
    if (inviteError.code === '23505') {
      throw new Error('El usuario ya es miembro de esta organizacion.');
    }
    console.error('Error inviting user:', inviteError);
    throw inviteError;
  }
}
