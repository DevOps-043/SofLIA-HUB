import { useCallback, useEffect } from 'react';
import { isSofiaConfigured } from '../../lib/sofia-client';
import { sofiaAuth } from '../../services/sofia-auth';
import { isOrbWindowRenderer, publishAuthState } from '../../services/auth-state';
import { setUserPreferenceScope } from '../../services/user-scope';
import { useAuthLifecycle } from './useAuthLifecycle';
import { useAuthState } from './useAuthState';
import { useLiaSession } from './useLiaSession';
import { useSofiaResolver } from './useSofiaResolver';
import { useSofiaSelection } from './useSofiaSelection';
import { useSofiaSignIn } from './useSofiaSignIn';
import { useLearningSso } from './useLearningSso';
import { useSignOut } from './useSignOut';
import type { AuthContextType } from './types';

export function useAuthProviderModel(): AuthContextType {
  const state = useAuthState();
  const usingSofia = isSofiaConfigured();
  const dataUserId = usingSofia ? state.session?.user?.id ?? null : state.session?.user?.id ?? state.user?.id ?? null;
  const signOut = useSignOut(usingSofia, state.clearSessionState);
  const resolveSofiaContext = useSofiaResolver();
  const lia = useLiaSession(state);
  const ensureLiaSession = lia.ensureLiaSession;
  const signInWithSofia = useSofiaSignIn({ ...state, ensureLiaSession, signOut });
  const learningSso = useLearningSso({ ...state, ensureLiaSession, signOut });
  const selection = useSofiaSelection(state);
  const retryConversations = useCallback(
    async () => Boolean(await ensureLiaSession(state.user?.email)),
    [ensureLiaSession, state.user?.email],
  );

  useAuthLifecycle({
    ...state,
    usingSofia,
    signOut,
    resolveSofiaContext,
    ensureLiaSession,
  });

  // El proceso main niega por defecto las funciones sensibles (orbe, deteccion
  // de reuniones) hasta conocer que hay sesion. Se publica en cada cambio de
  // usuario: login, cierre de sesion y restauracion al arrancar.
  const authenticatedUserId = state.user?.id ?? null;
  const authLoading = state.loading;
  const accessToken = state.session?.access_token ?? null;
  const refreshToken = state.session?.refresh_token ?? null;

  // Las preferencias locales (favoritos y ajustes del navegador, modelo elegido,
  // perfil personal) se acotan al usuario activo. Se fija durante el render, no
  // en un efecto: las vistas hijas leen `localStorage` en su primer render y no
  // deben poder ver las preferencias de la sesion anterior ni por un instante.
  setUserPreferenceScope(authenticatedUserId);
  useEffect(() => {
    // Solo la ventana principal publica: la orbe es consumidora del gate.
    if (isOrbWindowRenderer()) return;
    // Mientras se restaura la sesion no se publica: un `false` transitorio
    // revocaria el acceso y cerraria la orbe recien abierta.
    if (authLoading) return;
    void (async () => {
      const sofiaSession = usingSofia ? await sofiaAuth.getSession() : null;
      await publishAuthState({
        authenticated: Boolean(authenticatedUserId),
        userId: authenticatedUserId,
        accessToken: accessToken ?? null,
        refreshToken: refreshToken ?? null,
        // Este token solo se canjea en main; nunca se persiste ni vuelve al renderer.
        sofiaAccessToken: sofiaSession?.access_token ?? null,
        // Main custodia únicamente el refresh token cifrado para que WhatsApp
        // conserve identidad SOFIA después de cerrar la ventana o reiniciar.
        sofiaRefreshToken: sofiaSession?.refresh_token ?? null,
      });
    })();
    // Los tokens entran en las dependencias para republicar cuando la sesión se
    // renueva: si no, el main se quedaría con el token viejo hasta reiniciar.
  }, [accessToken, authLoading, authenticatedUserId, refreshToken, usingSofia]);

  return {
    session: state.session,
    user: state.user,
    dataUserId,
    loading: state.loading,
    signOut,
    usingSofia,
    sofiaContext: state.sofiaContext,
    liaDegraded: state.liaDegraded,
    liaStatusMessage: state.liaStatusMessage,
    retryConversations,
    signInWithSofia,
    learningSsoAvailable: learningSso.learningSsoAvailable,
    signInWithLearningSso: learningSso.signInWithLearningSso,
    cancelLearningSso: learningSso.cancelLearningSso,
    ssoPending: learningSso.ssoPending,
    ssoError: learningSso.ssoError,
    setCurrentOrganization: selection.setCurrentOrganization,
    setCurrentTeam: selection.setCurrentTeam,
  };
}
