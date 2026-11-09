import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sofiaAuth, type SofiaAuthResult, type SofiaContext } from '../../services/sofia-auth';
import { buildSofiaContext } from './helpers';
import type { AuthUser } from './types';
import type { AuthOperations } from './auth-operations';

type SofiaSignInDeps = {
  operations: AuthOperations;
  setLoading: (value: boolean) => void;
  ensureLiaSession: (email?: string | null, sofiaAccessToken?: string | null, signal?: AbortSignal) => Promise<Session | null>;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
  setSofiaSession: (value: Session | null) => void;
  signOut: () => Promise<void>;
};

export const CANCELLED_AUTH_RESULT: SofiaAuthResult = {
  success: false, session: null, user: null, error: 'Solicitud de acceso cancelada.',
};

export function useSofiaSignIn({ operations, setLoading, ensureLiaSession, setSofiaContext, setUser, setSofiaSession, signOut }: SofiaSignInDeps) {
  return useCallback(async (emailOrUsername: string, password: string): Promise<SofiaAuthResult> => {
    const intent = operations.begin('login');
    if (!operations.isCurrent(intent.signal)) return CANCELLED_AUTH_RESULT;
    setLoading(false);
    let denied = false;
    try {
      const result = await operations.enqueue(intent.signal, async () => {
        const response = await sofiaAuth.signInWithSofia(emailOrUsername, password, intent.signal);
        if (!operations.isCurrent(intent.signal)) return CANCELLED_AUTH_RESULT;
        if (!response.success || !response.user) return response;
        if (!response.session?.user?.id || !operations.adopt(intent.signal, response.session.user.id)) {
          operations.cancel(intent.signal);
          return CANCELLED_AUTH_RESULT;
        }

        const nextSofiaContext = response.sofiaProfile ? buildSofiaContext(response.sofiaProfile) : null;
        if (!nextSofiaContext) {
          denied = true;
          return { ...response, success: false, error: 'Acceso denegado: No tienes una membresia activa en SOFIA.' };
        }
        setUser(response.user);
        setSofiaSession(response.session);
        setSofiaContext(nextSofiaContext);
        const liaSession = await ensureLiaSession(response.session.user.email, response.session.access_token, intent.signal);
        if (!operations.isCurrent(intent.signal)) return CANCELLED_AUTH_RESULT;
        return { ...response, session: liaSession, user: response.user };
      });
      if (denied && operations.isCurrent(intent.signal)) await signOut();
      return result ?? CANCELLED_AUTH_RESULT;
    } catch {
      if (!operations.isCurrent(intent.signal)) return CANCELLED_AUTH_RESULT;
      return { success: false, session: null, user: null, error: 'No pudimos completar el inicio de sesion. Intenta nuevamente.' };
    } finally {
      if (operations.isCurrent(intent.signal)) setLoading(false);
      operations.finish(intent);
    }
  }, [operations, setLoading, ensureLiaSession, setSofiaContext, setUser, setSofiaSession, signOut]);
}
