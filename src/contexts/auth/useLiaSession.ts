import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { buildLiaStatusMessage } from './lia-status-message';
import { normalizeEmail } from './helpers';
import { syncLiaProfile } from './lia-profile';
import type { LiaSessionSyncResult } from './types';

type LiaSessionDeps = {
  setSession: (session: Session | null) => void;
  setLiaDegraded: (degraded: boolean) => void;
  setLiaStatusMessage: (message: string | null) => void;
};

export function useLiaSession({ setSession, setLiaDegraded, setLiaStatusMessage }: LiaSessionDeps) {
  const syncOptionalLiaSession = useCallback(async (expectedEmail?: string | null): Promise<LiaSessionSyncResult> => {
    const normalizedExpectedEmail = normalizeEmail(expectedEmail);
    try {
      let { data: { session: liaSession } } = await supabase.auth.getSession();
      if (!liaSession) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        liaSession = refreshData.session;
      }

      const liaEmail = normalizeEmail(liaSession?.user?.email);
      if (liaSession && normalizedExpectedEmail && liaEmail && liaEmail !== normalizedExpectedEmail) {
        await supabase.auth.signOut();
        setSession(null);
        return { session: null, retryAllowed: true };
      }

      setSession(liaSession ?? null);
      if (liaSession) await syncLiaProfile(liaSession);
      return { session: liaSession ?? null, retryAllowed: true };
    } catch (error) {
      console.warn('No se pudo restaurar la sesion opcional de Lia:', error);
      setSession(null);
      return { session: null, retryAllowed: false, error };
    }
  }, [setSession]);

  const ensureLiaSession = useCallback(async (email?: string | null, password?: string): Promise<Session | null> => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return failLiaSession(setSession, setLiaDegraded, setLiaStatusMessage);

    const restoredSession = await syncOptionalLiaSession(normalizedEmail);
    if (restoredSession.session) return acceptLiaSession(restoredSession.session, setLiaDegraded, setLiaStatusMessage);
    if (!restoredSession.retryAllowed) {
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(restoredSession.error));
      return null;
    }

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInData.session) return acceptLiaSession(signInData.session, setLiaDegraded, setLiaStatusMessage, setSession);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (signUpData.session) return acceptLiaSession(signUpData.session, setLiaDegraded, setLiaStatusMessage, setSession);

      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(signUpError || signInError));
      return null;
    } catch (error) {
      console.warn('No se pudo abrir la sesion de Lia tras autenticar SOFIA:', error);
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(error));
      return null;
    }
  }, [setLiaDegraded, setLiaStatusMessage, setSession, syncOptionalLiaSession]);

  return { ensureLiaSession, syncOptionalLiaSession };
}

function failLiaSession(setSession: (session: Session | null) => void, setDegraded: (value: boolean) => void, setMessage: (value: string | null) => void): null {
  setSession(null);
  setDegraded(true);
  setMessage('No fue posible obtener las credenciales necesarias para sincronizar conversaciones con Lia.');
  return null;
}

function acceptLiaSession(session: Session, setDegraded: (value: boolean) => void, setMessage: (value: string | null) => void, setSession?: (session: Session | null) => void): Session {
  setSession?.(session);
  void syncLiaProfile(session);
  setDegraded(false);
  setMessage(null);
  return session;
}
