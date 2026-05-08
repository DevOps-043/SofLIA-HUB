import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sofiaAuth, type SofiaAuthResult, type SofiaContext } from '../../services/sofia-auth';
import { storeLiaCredentials } from './lia-credentials';
import { buildSofiaContext } from './helpers';
import type { AuthUser } from './types';

type SofiaSignInDeps = {
  ensureLiaSession: (email?: string | null, password?: string) => Promise<Session | null>;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
  signOut: () => Promise<void>;
};

export function useSofiaSignIn({ ensureLiaSession, setSofiaContext, setUser, signOut }: SofiaSignInDeps) {
  return useCallback(async (emailOrUsername: string, password: string): Promise<SofiaAuthResult> => {
    const result = await sofiaAuth.signInWithSofia(emailOrUsername, password);
    if (!result.success || !result.user) return result;

    const nextSofiaContext = result.sofiaProfile ? buildSofiaContext(result.sofiaProfile) : null;
    if (!nextSofiaContext) {
      await signOut();
      return { ...result, success: false, error: 'Acceso denegado: No tienes una membresia activa en SOFIA.' };
    }

    setUser(result.user);
    setSofiaContext(nextSofiaContext);
    const liaSession = await ensureLiaSession(result.user.email, password);
    if (liaSession && result.user.email) storeLiaCredentials(result.user.email, password);
    return { ...result, session: liaSession, user: result.user };
  }, [ensureLiaSession, setSofiaContext, setUser, signOut]);
}
