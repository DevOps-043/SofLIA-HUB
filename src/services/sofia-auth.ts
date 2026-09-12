import type { Session } from '@supabase/supabase-js';

import { isSofiaConfigured, sofiaSupa } from '../lib/sofia-client';
import type { SofiaOrganization, SofiaTeam } from '../lib/sofia-client';
import { buildActiveSofiaContext, createPseudoAuthUser } from './sofia-auth/context';
import { INVALID_CREDENTIALS_MESSAGE, mapSupabaseAuthError, resolveLoginEmail } from './sofia-auth/login';
import type { SofiaLoginUserRow } from './sofia-auth/login';
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
      console.log('[SOFIA] Iniciando sesion via Supabase Auth');

      // 1. Traducir email/username al correo con el que se autentica. El perfil
      //    ya no se lee aqui: sin sesion no hay acceso a public.users.
      const email = await resolveLoginEmail(emailOrUsername);
      if (!email) throw new Error(INVALID_CREDENTIALS_MESSAGE);

      // 2. Validar la contraseña contra Supabase Auth (auth.users), la unica
      //    fuente de verdad desde la migracion de SofLIA Learning.
      const { data: authData, error: authError } = await sofiaSupa.auth.signInWithPassword({
        email,
        password,
      });
      if (authError || !authData?.user) {
        console.warn('[SOFIA] Supabase Auth rechazo el login:', authError?.message || 'sin usuario');
        throw new Error(mapSupabaseAuthError(authError?.message));
      }

      // 3. Ya con sesion, el perfil y las membresias salen de public.users.
      return await this.completeAuthenticatedSession(authData.user.id, authData.session);
    } catch (err) {
      console.error('Error en signInWithSofia:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido al iniciar sesion';
      return { success: false, user: null, session: null, error: message };
    }
  }

  /**
   * Cierra una sesion abierta por el inicio federado con SofLIA Learning.
   *
   * Llega aqui con la sesion Supabase ya establecida por el canje del ticket,
   * asi que solo falta resolver perfil y membresia: exactamente los mismos
   * pasos que el inicio por contrasena, sin ninguna via alterna de autorizacion.
   */
  async completeSofiaSsoSession(session: Session): Promise<SofiaAuthResult> {
    if (!isSofiaConfigured() || !sofiaSupa) {
      return { success: false, user: null, session: null, error: 'SOFIA no esta configurado. Verifica las variables de entorno.' };
    }

    try {
      if (!session.user?.email) throw new Error('Acceso denegado: la sesion no tiene un correo asociado.');

      // El perfil se resuelve contra la sesion ya autenticada, no por correo:
      // `get_desktop_user_profile` solo devuelve la fila de auth.uid(), asi que
      // la identidad no puede diferir de la que se acaba de canjear.
      return await this.completeAuthenticatedSession(session.user.id, session);
    } catch (err) {
      console.error('Error en completeSofiaSsoSession:', err);
      // Nunca dejar una sesion de Supabase Auth abierta tras un fallo.
      await sofiaSupa.auth.signOut().catch(() => undefined);
      const message = err instanceof Error ? err.message : 'Error desconocido al iniciar sesion';
      return { success: false, user: null, session: null, error: message };
    }
  }

  /**
   * Perfil, contexto activo y sesion local a partir de una identidad ya
   * autenticada. Compartido por el inicio con contrasena y el federado para que
   * ambos apliquen las mismas guardas de membresia.
   */
  private async completeAuthenticatedSession(
    userId: string,
    session: Session | null,
  ): Promise<SofiaAuthResult> {
    const sofiaProfile = await this.fetchSofiaUserProfile(userId);
    if (!sofiaProfile) {
      // Sin perfil no se puede decidir la membresia. Cerrar la sesion recien
      // abierta evita dejar al usuario "dentro" sin contexto ni permisos.
      await sofiaSupa!.auth.signOut().catch(() => undefined);
      throw new Error('No se pudo cargar tu perfil. Intenta de nuevo en unos momentos.');
    }

    try {
      this.sofiaContext = buildActiveSofiaContext(sofiaProfile);
    } catch (contextError) {
      // Sin membresia activa: no dejar una sesion de Supabase Auth abierta.
      await sofiaSupa!.auth.signOut().catch(() => undefined);
      throw contextError;
    }

    const userRow: SofiaLoginUserRow = {
      id: sofiaProfile.id,
      username: sofiaProfile.username,
      email: sofiaProfile.email,
      first_name: sofiaProfile.first_name ?? null,
      last_name: sofiaProfile.last_name ?? null,
      display_name: sofiaProfile.full_name || null,
      profile_picture_url: sofiaProfile.avatar_url || null,
      platform_role: sofiaProfile.platform_role || null,
    };
    await saveSofiaSession(userRow);

    return {
      success: true,
      user: createPseudoAuthUser(userRow, userRow.profile_picture_url ?? null),
      session,
      sofiaProfile,
    };
  }

  async fetchSofiaUserProfile(userId: string) {
    return fetchSofiaUserProfile(userId);
  }

  async signOut() {
    localStorage.removeItem('sofia-session');
    this.sofiaContext = null;
    // Cerrar tambien la sesion de Supabase Auth; no debe bloquear el logout local.
    if (sofiaSupa) await sofiaSupa.auth.signOut().catch((err) => console.warn('[SOFIA] signOut de Supabase fallo:', err));
  }

  async getSession(): Promise<Session | null> {
    // La sesión de Supabase es la única que contiene credenciales verificables.
    // El snapshot `sofia-session` sirve para pintar el perfil, pero reconstruir
    // un `Session` desde él descartaba access_token/refresh_token: la UI quedaba
    // autenticada mientras Project Hub y Lia no podían hacer el canje federado.
    if (sofiaSupa) {
      const { data, error } = await sofiaSupa.auth.getSession();
      if (!error && data.session) return data.session;
      if (error) console.warn('[SOFIA] No se pudo restaurar la sesión verificable:', error.message);
    }

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
    } as unknown as Session;
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
    if (sofiaSupa) {
      return sofiaSupa.auth.onAuthStateChange((event, session) => callback(event, session));
    }

    this.getSession()
      .then((session) => session && callback('INITIAL_SESSION', session))
      .catch((err) => console.error('Error en onAuthStateChange:', err));

    return { data: { subscription: { unsubscribe: () => {} } } };
  }
}

export const sofiaAuth = new SofiaAuthService();
