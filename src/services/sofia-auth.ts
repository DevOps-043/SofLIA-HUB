import { Session } from '@supabase/supabase-js';
import {
  sofiaSupa,
  isSofiaConfigured,
  SofiaOrganization,
  SofiaTeam,
  SofiaUserProfile,
  SofiaOrganizationUser
} from '../lib/sofia-client';

export interface SofiaAuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

export interface SofiaAuthResult {
  success: boolean;
  user: SofiaAuthUser | null;
  session: Session | null;
  error?: string;
  sofiaProfile?: SofiaUserProfile | null;
}

export interface SofiaContext {
  user: SofiaUserProfile | null;
  currentOrganization: SofiaOrganization | null;
  currentTeam: SofiaTeam | null;
  organizations: SofiaOrganization[];
  teams: SofiaTeam[];
  memberships: SofiaOrganizationUser[];
}

class SofiaAuthService {
  private sofiaContext: SofiaContext | null = null;

  async signInWithSofia(emailOrUsername: string, password: string): Promise<SofiaAuthResult> {
    if (!isSofiaConfigured() || !sofiaSupa) {
      return {
        success: false,
        user: null,
        session: null,
        error: 'SOFIA no esta configurado. Verifica las variables de entorno.'
      };
    }

    try {
      console.log('Intentando autenticar con SOFIA:', { identifier: emailOrUsername });

      const { data: authResult, error: authError } = await sofiaSupa
        .rpc('authenticate_user', {
          p_identifier: emailOrUsername,
          p_password: password
        });

      if (authError) {
        console.error('Error llamando authenticate_user:', authError);
        return {
          success: false,
          user: null,
          session: null,
          error: authError.message || 'Error de conexion con SOFIA'
        };
      }

      if (!authResult?.success) {
        return {
          success: false,
          user: null,
          session: null,
          error: authResult?.error || 'Credenciales invalidas'
        };
      }

      const sofiaUser = authResult.user;

      const sofiaProfile = await this.fetchSofiaUserProfile(sofiaUser.id);

      this.sofiaContext = {
        user: sofiaProfile,
        currentOrganization: sofiaProfile?.organizations?.[0] || null,
        currentTeam: sofiaProfile?.teams?.[0] || null,
        organizations: sofiaProfile?.organizations || [],
        teams: sofiaProfile?.teams || [],
        memberships: sofiaProfile?.memberships || []
      };

      await this.saveSofiaSession(sofiaUser);

      const pseudoUser: SofiaAuthUser = {
        id: sofiaUser.id,
        email: sofiaUser.email,
        user_metadata: {
          first_name: sofiaUser.first_name,
          last_name: sofiaUser.last_name,
          avatar_url: sofiaUser.profile_picture_url
        }
      };

      return {
        success: true,
        user: pseudoUser,
        session: null,
        sofiaProfile
      };
    } catch (err: any) {
      console.error('Error en signInWithSofia:', err);
      return {
        success: false,
        user: null,
        session: null,
        error: err.message || 'Error desconocido al iniciar sesion'
      };
    }
  }

  async fetchSofiaUserProfile(userId: string): Promise<SofiaUserProfile | null> {
    if (!sofiaSupa) return null;

    try {
      const { data: user, error: userError } = await sofiaSupa
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.warn('No se encontro usuario en SOFIA:', userError);
        return null;
      }

      const { data: memberships, error: membershipsError } = await sofiaSupa
        .from('organization_users')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          status,
          job_title,
          team_id,
          zone_id,
          region_id,
          joined_at,
          organizations (
            id,
            name,
            slug,
            description,
            logo_url,
            contact_email,
            subscription_plan,
            subscription_status,
            brand_color_primary,
            brand_color_secondary,
            brand_favicon_url,
            is_active,
            created_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (membershipsError) {
        console.warn('Error obteniendo membresias:', membershipsError);
      }

      const organizations: SofiaOrganization[] = [];
      const orgIds = new Set<string>();

      memberships?.forEach((m: any) => {
        if (m.organizations && !orgIds.has(m.organizations.id)) {
          orgIds.add(m.organizations.id);
          organizations.push(m.organizations);
        }
      });

      const teamIds = memberships
        ?.filter((m: any) => m.team_id)
        .map((m: any) => m.team_id) || [];

      let teams: SofiaTeam[] = [];
      if (teamIds.length > 0) {
        const { data: teamsData } = await sofiaSupa
          .from('organization_teams')
          .select('*')
          .in('id', teamIds)
          .eq('is_active', true);

        teams = teamsData || [];
      }

      const fullName = user.display_name ||
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.username;

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: fullName,
        avatar_url: user.profile_picture_url,
        cargo_rol: user.cargo_rol,
        organizations,
        teams,
        memberships: memberships?.map((m: any) => ({
          id: m.id,
          organization_id: m.organization_id,
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          job_title: m.job_title,
          team_id: m.team_id,
          zone_id: m.zone_id,
          region_id: m.region_id,
          joined_at: m.joined_at,
          organization: m.organizations
        })) || []
      };
    } catch (err) {
      console.error('Error fetching SOFIA profile:', err);
      return null;
    }
  }

  private async saveSofiaSession(user: any) {
    const sessionData = {
      user,
      timestamp: Date.now()
    };
    localStorage.setItem('sofia-session', JSON.stringify(sessionData));
  }

  private getSofiaStoredSession(): any | null {
    const stored = localStorage.getItem('sofia-session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
          return session.user;
        }
      } catch { /* invalid JSON */ }
    }
    return null;
  }

  async signOut() {
    localStorage.removeItem('sofia-session');
    this.sofiaContext = null;
  }

  async getSession(): Promise<Session | null> {
    const storedUser = this.getSofiaStoredSession();
    if (storedUser) {
      return {
        user: {
          id: storedUser.id,
          email: storedUser.email,
          user_metadata: {
            first_name: storedUser.first_name,
            last_name: storedUser.last_name,
            avatar_url: storedUser.profile_picture_url
          }
        }
      } as any;
    }
    return null;
  }

  getSofiaContext(): SofiaContext | null {
    return this.sofiaContext;
  }

  setCurrentOrganization(org: SofiaOrganization) {
    if (this.sofiaContext) {
      this.sofiaContext.currentOrganization = org;
      this.sofiaContext.currentTeam = this.sofiaContext.teams.find(
        t => t.organization_id === org.id
      ) || null;
    }
  }

  setCurrentTeam(team: SofiaTeam) {
    if (this.sofiaContext) {
      this.sofiaContext.currentTeam = team;
    }
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.getSession().then(session => {
      if (session) {
        callback('INITIAL_SESSION', session);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  }
}

export const sofiaAuth = new SofiaAuthService();
