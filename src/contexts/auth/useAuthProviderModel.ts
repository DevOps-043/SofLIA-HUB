import { useCallback } from 'react';
import { isSofiaConfigured } from '../../lib/sofia-client';
import { sofiaAuth } from '../../services/sofia-auth';
import { setUserPreferenceScope } from '../../services/user-scope';
import { useAuthLifecycle } from './useAuthLifecycle';
import { useAuthState } from './useAuthState';
import { useAuthOperations } from './useAuthOperations';
import { useAuthPublication } from './useAuthPublication';
import { useLiaSession } from './useLiaSession';
import { useSofiaContextRetry } from './useSofiaContextRetry';
import { useSofiaResolver } from './useSofiaResolver';
import { useSofiaSelection } from './useSofiaSelection';
import { useSofiaSignIn } from './useSofiaSignIn';
import { useLearningSso } from './useLearningSso';
import { useSignOut } from './useSignOut';
import type { AuthContextType } from './types';

export function useAuthProviderModel(): AuthContextType {
  const state = useAuthState();
  const operations = useAuthOperations(state.revokeSession);
  const ownerSignal = operations.capture();
  const usingSofia = isSofiaConfigured();
  const dataUserId = usingSofia ? state.session?.user?.id ?? null : state.session?.user?.id ?? state.user?.id ?? null;
  const signOut = useSignOut({ usingSofia, operations, setLoading: state.setLoading });
  const resolveSofiaContext = useSofiaResolver();
  const lia = useLiaSession(state);
  const ensureLiaSession = lia.ensureLiaSession;
  const signInWithSofia = useSofiaSignIn({ ...state, operations, ensureLiaSession, signOut });
  const learningSso = useLearningSso({ ...state, operations, ensureLiaSession, signOut });
  const selection = useSofiaSelection(state);
  const retrySofiaContext = useSofiaContextRetry({
    issue: state.sofiaContextIssue,
    operations,
    usingSofia,
    userId: state.user?.id ?? null,
    resolveSofiaContext,
    setSofiaContext: state.setSofiaContext,
    setSofiaContextIssue: state.setSofiaContextIssue,
  });

  // El boton "Reintentar" del panel lateral cubre las dos caidas posibles: la
  // sesion de conversaciones y el directorio de organizaciones. El canje de Lia
  // necesita el token de SOFIA; sin el responde `not_authenticated` y el
  // reintento manual nunca podia recuperarse.
  const retryConversations = useCallback(async () => {
    if (!operations.isCurrent(ownerSignal) || !operations.canRestore() || !state.user) return false;
    try {
      const sofiaSession = usingSofia ? await sofiaAuth.getSession() : null;
      if (!operations.isCurrent(ownerSignal)) return false;
      if (usingSofia && !operations.matchesSubject(ownerSignal, sofiaSession?.user?.id ?? null)) {
        operations.cancel(ownerSignal);
        return false;
      }
      const [liaSession] = await Promise.all([
        operations.enqueue(ownerSignal, () => ensureLiaSession(
          usingSofia ? sofiaSession?.user.email : state.user?.email, sofiaSession?.access_token ?? null, ownerSignal)),
        state.sofiaContextIssue ? retrySofiaContext() : Promise.resolve(true),
      ]);
      return operations.isCurrent(ownerSignal) && Boolean(liaSession);
    } catch {
      if (operations.isCurrent(ownerSignal)) console.warn('[autenticacion] no se pudo reintentar conversaciones');
      return false;
    }
  }, [operations, ownerSignal, ensureLiaSession, retrySofiaContext, state.sofiaContextIssue, state.user, usingSofia]);

  const ensureLifecycleLia = useCallback((email?: string | null, token?: string | null, signal?: AbortSignal) => {
    const scope = operations.capture();
    return operations.enqueue(scope, () => ensureLiaSession(email, token, signal ?? scope));
  }, [operations, ensureLiaSession]);

  useAuthLifecycle({
    ...state,
    operations,
    usingSofia,
    signOut,
    resolveSofiaContext,
    ensureLiaSession: ensureLifecycleLia,
  });

  const authenticatedUserId = state.user?.id ?? null;
  // Las preferencias se acotan durante render porque las vistas hijas las leen
  // al montarse. No son evidencia de autenticación.
  setUserPreferenceScope(authenticatedUserId);
  useAuthPublication({ operations, ownerSignal, usingSofia, revocation: state.revocation,
    loading: state.loading, userId: authenticatedUserId,
    organizationId: state.sofiaContext?.currentOrganization?.id ?? null, session: state.session, sofiaSession: state.sofiaSession });

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
    sofiaContextDegraded: state.sofiaContextIssue !== null,
    sofiaStatusMessage: state.sofiaContextIssue?.message ?? null,
    sofiaContextRetryable: state.sofiaContextIssue?.retryable ?? false,
    retrySofiaContext,
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
