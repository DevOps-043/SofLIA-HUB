import { sofiaSupa, SofiaOrganizationUser, SofiaUser } from '../lib/sofia-client';

export interface OrgMember extends SofiaOrganizationUser {
  user_profile?: SofiaUser;
}

class OrgService {
  /**
   * Obtiene todos los miembros de una organización
   */
  async getOrganizationMembers(organizationId: string): Promise<OrgMember[]> {
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
      
      // Mapeo seguro
      return (data || []).map((m: any) => ({
        ...m,
        user_profile: m.user_profile || null
      }));
    } catch (err) {
      console.error('[OrgService] Exception in getOrganizationMembers:', err);
      throw err;
    }
  }

  /**
   * Actualiza el rol de un miembro
   */
  async updateMemberRole(membershipId: string, role: 'owner' | 'admin' | 'member'): Promise<void> {
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

  /**
   * Cambia el estado de un miembro (active, suspended, etc.)
   */
  async updateMemberStatus(membershipId: string, status: 'active' | 'suspended' | 'removed'): Promise<void> {
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

  /**
   * Invita a un usuario a la organización por email o username
   * Nota: Esto asume que el usuario ya existe en SOFIA.
   */
  async inviteUser(organizationId: string, identifier: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    if (!sofiaSupa) return;

    // 1. Buscar al usuario
    const { data: user, error: userError } = await sofiaSupa
      .from('users')
      .select('id')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .single();

    if (userError || !user) {
      throw new Error('Usuario no encontrado en SOFIA. Asegúrate de que el email o username sea correcto.');
    }

    // 2. Crear la membresía
    const { error: inviteError } = await sofiaSupa
      .from('organization_users')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        role,
        status: 'active' // Podría ser 'invited' si hubiera flujo de aceptación
      });

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new Error('El usuario ya es miembro de esta organización.');
      }
      console.error('Error inviting user:', inviteError);
      throw inviteError;
    }
  }
}

export const orgService = new OrgService();
