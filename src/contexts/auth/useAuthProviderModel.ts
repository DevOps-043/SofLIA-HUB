import { isSofiaConfigured } from '../../lib/sofia-client';
import { useAuthLifecycle } from './useAuthLifecycle';
import { useAuthState } from './useAuthState';
import { useLiaSession } from './useLiaSession';
import { useSofiaResolver } from './useSofiaResolver';
import { useSofiaSelection } from './useSofiaSelection';
import { useSofiaSignIn } from './useSofiaSignIn';
import { useSignOut } from './useSignOut';
import type { AuthContextType } from './types';

export function useAuthProviderModel(): AuthContextType {
  const state = useAuthState();
  const usingSofia = isSofiaConfigured();
  const dataUserId = usingSofia ? state.session?.user?.id ?? null : state.session?.user?.id ?? state.user?.id ?? null;
  const signOut = useSignOut(usingSofia, state.clearSessionState);
  const resolveSofiaContext = useSofiaResolver();
  const lia = useLiaSession(state);
  const signInWithSofia = useSofiaSignIn({ ...state, ensureLiaSession: lia.ensureLiaSession, signOut });
  const selection = useSofiaSelection(state);

  useAuthLifecycle({
    ...state,
    usingSofia,
    signOut,
    resolveSofiaContext,
    ensureLiaSession: lia.ensureLiaSession,
    syncOptionalLiaSession: lia.syncOptionalLiaSession,
  });

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
    signInWithSofia,
    setCurrentOrganization: selection.setCurrentOrganization,
    setCurrentTeam: selection.setCurrentTeam,
  };
}
