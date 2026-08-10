import { useCallback, useEffect } from 'react';
import { isSofiaConfigured } from '../../lib/sofia-client';
import { isOrbWindowRenderer, publishAuthState } from '../../services/auth-state';
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
  useEffect(() => {
    // Solo la ventana principal publica: la orbe es consumidora del gate.
    if (isOrbWindowRenderer()) return;
    // Mientras se restaura la sesion no se publica: un `false` transitorio
    // revocaria el acceso y cerraria la orbe recien abierta.
    if (authLoading) return;
    void publishAuthState({
      authenticated: Boolean(authenticatedUserId),
      userId: authenticatedUserId,
    });
  }, [authenticatedUserId, authLoading]);

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
