import { sofiaSupa } from '../../lib/sofia-client';
import type { SofiaOrganization, SofiaTeam, SofiaUserProfile } from '../../lib/sofia-client';

/**
 * Error de una consulta a SOFIA con el paso y el codigo de PostgREST intactos.
 *
 * `fetchSofiaUserProfile` sigue devolviendo `null` ante cualquier fallo (el
 * llamador distingue "sin membresia" de "no disponible" por eso), pero perder el
 * motivo hacia indistinguibles un corte de red, un rechazo de permisos y una
 * fila ausente. El diagnostico va al log, nunca a la interfaz.
 */
class SofiaQueryError extends Error {
  constructor(readonly step: string, readonly detail: Record<string, unknown>) {
    super(String(detail.message || 'consulta rechazada'));
    this.name = 'SofiaQueryError';
  }
}

function describe(step: string, error: { message?: string; code?: string; details?: string; hint?: string }): SofiaQueryError {
  return new SofiaQueryError(step, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export async function fetchSofiaUserProfile(userId: string): Promise<SofiaUserProfile | null> {
  if (!sofiaSupa) {
    console.error('[SOFIA] Cliente no configurado: revisa VITE_SOFIA_SUPABASE_URL y VITE_SOFIA_SUPABASE_ANON_KEY.');
    return null;
  }

  try {
    // public.users esta cerrada a lectura directa desde el endurecimiento de la
    // instancia; la funcion devuelve solo la fila de quien llama (auth.uid()).
    // Ver database/sofia-learning/migrations/desktop-users-read-access.sql.
    const { data: perfil, error: userError } = await sofiaSupa.rpc('get_desktop_user_profile');
    if (userError) throw describe('get_desktop_user_profile', userError);

    const user = Array.isArray(perfil) ? perfil[0] : perfil;
    if (!user) {
      // Sin fila propia no hay perfil que construir. No es un fallo de red: la
      // sesion no corresponde a ningun usuario de la plataforma.
      console.error('[SOFIA] La sesion no tiene fila en public.users.', { userId });
      return null;
    }

    const { data: memberships, error: membershipsError } = await sofiaSupa
      .from('organization_users')
      .select(`
        id, organization_id, user_id, role, status, job_title, team_id, zone_id, region_id, joined_at,
        organizations (
          id, name, slug, description, logo_url, contact_email, subscription_plan,
          subscription_status, brand_color_primary, brand_color_secondary,
          brand_favicon_url, is_active, created_at
        )
      `)
      .eq('user_id', userId);

    if (membershipsError) throw describe('organization_users', membershipsError);

    const organizations = collectOrganizations(memberships || []);
    const teams = await fetchActiveTeams((memberships || []).filter((item: any) => item.team_id).map((item: any) => item.team_id));
    const fullName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: fullName,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      avatar_url: user.profile_picture_url,
      platform_role: user.platform_role,
      organizations,
      teams,
      memberships: memberships?.map((membership: any) => ({
        id: membership.id,
        organization_id: membership.organization_id,
        user_id: membership.user_id,
        role: membership.role,
        status: membership.status,
        job_title: membership.job_title,
        team_id: membership.team_id,
        zone_id: membership.zone_id,
        region_id: membership.region_id,
        joined_at: membership.joined_at,
        organization: membership.organizations,
      })) || [],
    };
  } catch (err) {
    if (err instanceof SofiaQueryError) {
      // El codigo de PostgREST es lo que separa las causas: `42501` y `PGRST301`
      // son permisos (RLS), `PGRST116` es fila ausente, `42703`/`PGRST200` son
      // esquema desalineado, y sin codigo suele ser red o timeout.
      console.error(`[SOFIA] Consulta "${err.step}" rechazada:`, err.detail);
    } else {
      console.error('[SOFIA] Perfil no disponible:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

function collectOrganizations(memberships: any[]): SofiaOrganization[] {
  const organizations: SofiaOrganization[] = [];
  const orgIds = new Set<string>();
  memberships.forEach((membership) => {
    if (membership.organizations && !orgIds.has(membership.organizations.id)) {
      orgIds.add(membership.organizations.id);
      organizations.push(membership.organizations);
    }
  });
  return organizations;
}

async function fetchActiveTeams(teamIds: string[]): Promise<SofiaTeam[]> {
  if (teamIds.length === 0 || !sofiaSupa) return [];
  const { data: teamsData, error: teamsError } = await sofiaSupa.from('organization_teams').select('*').in('id', teamIds).eq('is_active', true);
  if (teamsError) throw describe('organization_teams', teamsError);
  return teamsData || [];
}
