import { useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { exchangeSofiaForLiaSession } from '../../services/lia-session-exchange';
import { normalizeEmail } from './helpers';
import { syncLiaProfile } from './lia-profile';
import type { LiaSessionSyncResult } from './types';

type LiaSessionDeps = {
  setSession: (session: Session | null) => void;
  setLiaDegraded: (degraded: boolean) => void;
  setLiaStatusMessage: (message: string | null) => void;
};

export const CONVERSATIONS_UNAVAILABLE_MESSAGE = 'No pudimos cargar tus conversaciones. Intenta nuevamente.';

export function useLiaSession({ setSession, setLiaDegraded, setLiaStatusMessage }: LiaSessionDeps) {
  const pending = useRef<{ email: string | null; token?: string | null; promise: Promise<Session | null> } | null>(null);
  const syncOptionalLiaSession = useCallback(async (expectedEmail?: string | null): Promise<LiaSessionSyncResult> => {
    const normalizedExpectedEmail = normalizeEmail(expectedEmail);
    try {
      let { data: { session: liaSession } } = await supabase.auth.getSession();
      if (!liaSession) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        liaSession = refreshData.session;
      }

      const liaEmail = normalizeEmail(liaSession?.user?.email);
      if (liaSession && normalizedExpectedEmail && liaEmail !== normalizedExpectedEmail) {
        await supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        return { session: null, retryAllowed: true };
      }

      setSession(liaSession ?? null);
      return { session: liaSession ?? null, retryAllowed: true };
    } catch (error) {
      console.warn('[sesion-conversaciones] no se pudo restaurar la sesion');
      setSession(null);
      return { session: null, retryAllowed: false, error };
    }
  }, [setSession]);

  const resolveLiaSession = useCallback(async (
    email?: string | null,
    sofiaAccessToken?: string | null,
  ): Promise<Session | null> => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return degrade(setSession, setLiaDegraded, setLiaStatusMessage);

    const restored = await syncOptionalLiaSession(normalizedEmail);
    if (restored.session) return accept(restored.session, setSession, setLiaDegraded, setLiaStatusMessage);
    if (!restored.retryAllowed) return degrade(setSession, setLiaDegraded, setLiaStatusMessage);

    try {
      const liaSession = await exchangeSofiaForLiaSession(normalizedEmail, sofiaAccessToken);
      return accept(liaSession, setSession, setLiaDegraded, setLiaStatusMessage);
    } catch {
      console.warn('[sesion-conversaciones] intercambio no disponible');
      return degrade(setSession, setLiaDegraded, setLiaStatusMessage);
    }
  }, [setLiaDegraded, setLiaStatusMessage, setSession, syncOptionalLiaSession]);

  const ensureLiaSession = useCallback((email?: string | null, token?: string | null): Promise<Session | null> => {
    const normalizedEmail = normalizeEmail(email);
    if (pending.current?.email === normalizedEmail && pending.current.token === token) return pending.current.promise;
    const promise = resolveLiaSession(email, token).finally(() => {
      if (pending.current?.promise === promise) pending.current = null;
    });
    pending.current = { email: normalizedEmail, token, promise };
    return promise;
  }, [resolveLiaSession]);

  return { ensureLiaSession, syncOptionalLiaSession };
}

function accept(
  session: Session,
  setSession: (session: Session | null) => void,
  setDegraded: (value: boolean) => void,
  setMessage: (value: string | null) => void,
): Session {
  setSession(session);
  void syncLiaProfile(session).catch(() => {
    console.warn('[sesion-conversaciones] no se pudo sincronizar el perfil; la sesión sigue disponible');
  });
  setDegraded(false);
  setMessage(null);
  return session;
}

function degrade(
  setSession: (session: Session | null) => void,
  setDegraded: (value: boolean) => void,
  setMessage: (value: string | null) => void,
): null {
  setSession(null);
  setDegraded(true);
  setMessage(CONVERSATIONS_UNAVAILABLE_MESSAGE);
  return null;
}
