import { sofiaSupa } from '../../lib/sofia-client';
import type { OrgMember, OrgMemberStatus, OrgRole } from './types';

/** Fallo al listar miembros con un mensaje apto para la interfaz; el detalle técnico va al log. */
export class OrgMembersError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'OrgMembersError';
  }
}

/** Fila de `get_desktop_organization_members` (database/sofia-learning/migrations/desktop-organization-members.sql). */
interface DesktopOrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMember['role'];
  status: OrgMember['status'];
  job_title: string | null;
  team_id: string | null;
  joined_at: string | null;
  created_at: string | null;
  username: string | null;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

/** PostgREST o Postgres cuando la función todavía no existe en la instancia. */
const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883']);

/**
 * public.users está cerrada a lectura directa desde el endurecimiento de SOFIA,
 * así que embeber `users!user_id` hacía fallar la consulta entera. La función
 * devuelve sólo el perfil mínimo de cada miembro y sólo a miembros activos de
 * esa organización.
 */
export async function getOrganizationMembers(organizationId: string): Promise<OrgMember[]> {
  if (!sofiaSupa) {
    console.warn('[OrgService] Cliente SOFIA no configurado; no hay miembros que listar.');
    return [];
  }

  const { data, error } = await sofiaSupa.rpc('get_desktop_organization_members', { p_organization_id: organizationId });
  if (error) {
    console.error('[OrgService] get_desktop_organization_members rechazada.', { code: error.code, message: error.message, hint: error.hint });
    throw new OrgMembersError(
      MISSING_FUNCTION_CODES.has(error.code ?? '')
        ? 'SOFIA aún no tiene la actualización que permite listar miembros. Contacta al administrador de la plataforma.'
        : 'No se pudieron cargar los miembros de la organización.',
      error.code,
    );
  }
  return ((data ?? []) as DesktopOrganizationMemberRow[]).map(toOrgMember);
}

function toOrgMember(row: DesktopOrganizationMemberRow): OrgMember {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    job_title: row.job_title ?? undefined,
    team_id: row.team_id ?? undefined,
    joined_at: row.joined_at ?? undefined,
    // Sin fila en public.users (cuenta borrada) el miembro se muestra sin perfil.
    user_profile: row.username || row.email ? {
      id: row.user_id,
      username: row.username ?? '',
      email: row.email ?? '',
      display_name: row.display_name ?? undefined,
      first_name: row.first_name ?? undefined,
      last_name: row.last_name ?? undefined,
      profile_picture_url: row.profile_picture_url ?? undefined,
      created_at: row.created_at ?? '',
    } : undefined,
  };
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
