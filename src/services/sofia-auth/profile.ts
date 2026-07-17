import { sofiaSupa } from '../../lib/sofia-client';
import type { SofiaOrganization, SofiaTeam, SofiaUserProfile } from '../../lib/sofia-client';

export async function fetchSofiaUserProfile(userId: string): Promise<SofiaUserProfile | null> {
  if (!sofiaSupa) return null;

  try {
    const { data: user, error: userError } = await sofiaSupa.from('users').select('*').eq('id', userId).single();
    if (userError) throw new Error(userError.message);

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

    if (membershipsError) throw new Error(membershipsError.message);

    const organizations = collectOrganizations(memberships || []);
    const teams = await fetchActiveTeams((memberships || []).filter((item: any) => item.team_id).map((item: any) => item.team_id));
    const fullName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: fullName,
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
  } catch (err: any) {
    console.error('Error fetching SOFIA profile:', err.message || err);
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
  if (teamsError) throw new Error(teamsError.message);
  return teamsData || [];
}
