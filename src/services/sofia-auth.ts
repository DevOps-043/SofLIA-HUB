import type { Session } from '@supabase/supabase-js';

import { isSofiaConfigured, sofiaSupa } from '../lib/sofia-client';
import type { SofiaOrganization, SofiaTeam } from '../lib/sofia-client';
import { buildActiveSofiaContext, createPseudoAuthUser } from './sofia-auth/context';
import { fetchSofiaUserProfile } from './sofia-auth/profile';
import { getSofiaStoredSession, saveSofiaSession } from './sofia-auth/session-storage';
import type { SofiaAuthResult, SofiaContext } from './sofia-auth/types';

export type { SofiaAuthResult, SofiaAuthUser, SofiaContext } from './sofia-auth/types';

class SofiaAuthService {
  private sofiaContext: SofiaContext | null = null;

  async signInWithSofia(emailOrUsername: string, password: string): Promise<SofiaAuthResult> {
    if (!isSofiaConfigured() || !sofiaSupa) {
      return { success: false, user: null, session: null, error: 'SOFIA no esta configurado. Verifica las variables de entorno.' };
    }

    try {
      console.log('Intentando autenticar con SOFIA:', { identifier: emailOrUsername });
      const { data: authResult, error: authError } = await sofiaSupa.rpc('authenticate_user', {
        p_identifier: emailOrUsername,
        p_password: password,
      });

      if (authError) throw new Error(authError.message || 'Error de conexion con SOFIA');
      if (!authResult?.success) throw new Error(authResult?.error || 'Credenciales invalidas');

      const sofiaUser = authResult.user;
      const sofiaProfile = await this.fetchSofiaUserProfile(sofiaUser.id);
      this.sofiaContext = buildActiveSofiaContext(sofiaProfile);

      const resolvedAvatar = sofiaProfile?.avatar_url || sofiaUser.profile_picture_url || null;
      await saveSofiaSession({ ...sofiaUser, profile_picture_url: resolvedAvatar });

      return {
        success: true,
        user: createPseudoAuthUser(sofiaUser, resolvedAvatar),
        session: null,
        sofiaProfile,
      };
    } catch (err: any) {
      console.error('Error en signInWithSofia:', err);
      return { success: false, user: null, session: null, error: err.message || 'Error desconocido al iniciar sesion' };
    }
  }

  async fetchSofiaUserProfile(userId: string) {
    return fetchSofiaUserProfile(userId);
  }

  async signOut() {
    localStorage.removeItem('sofia-session');
    this.sofiaContext = null;
  }

  async getSession(): Promise<Session | null> {
    const storedUser = getSofiaStoredSession();
    if (!storedUser) return null;
    return {
      user: {
        id: storedUser.id,
        email: storedUser.email,
        user_metadata: {
          first_name: storedUser.first_name,
          last_name: storedUser.last_name,
          avatar_url: storedUser.profile_picture_url,
        },
      },
    } as any;
  }

  getSofiaContext(): SofiaContext | null {
    return this.sofiaContext;
  }

  setCurrentOrganization(org: SofiaOrganization) {
    if (!this.sofiaContext) return;
    this.sofiaContext.currentOrganization = org;
    this.sofiaContext.currentTeam = this.sofiaContext.teams.find((team) => team.organization_id === org.id) || null;
  }

  setCurrentTeam(team: SofiaTeam) {
    if (this.sofiaContext) this.sofiaContext.currentTeam = team;
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.getSession()
      .then((session) => session && callback('INITIAL_SESSION', session))
      .catch((err) => console.error('Error en onAuthStateChange:', err));

    return { data: { subscription: { unsubscribe: () => {} } } };
  }
}

export const sofiaAuth = new SofiaAuthService();
