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

const CANCELLED: LiaSessionSyncResult = { session: null, retryAllowed: false };
export const CONVERSATIONS_UNAVAILABLE_MESSAGE = 'No pudimos cargar tus conversaciones. Intenta nuevamente.';

export function useLiaSession({ setSession, setLiaDegraded, setLiaStatusMessage }: LiaSessionDeps) {
  const pending = useRef<{
    email: string | null;
    token?: string | null;
    signal?: AbortSignal;
    promise: Promise<Session | null>;
  } | null>(null);
  const syncOptionalLiaSession = useCallback(async (
    expectedEmail?: string | null,
    signal?: AbortSignal,
  ): Promise<LiaSessionSyncResult> => {
    if (signal?.aborted) return CANCELLED;
    const normalizedExpectedEmail = normalizeEmail(expectedEmail);
    try {
      let { data: { session: liaSession } } = await supabase.auth.getSession();
      if (signal?.aborted) return CANCELLED;
      if (!liaSession) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (signal?.aborted) return CANCELLED;
        liaSession = refreshData.session;
      }

      const liaEmail = normalizeEmail(liaSession?.user?.email);
      if (liaSession && normalizedExpectedEmail && liaEmail !== normalizedExpectedEmail) {
        await supabase.auth.signOut({ scope: 'local' });
        if (signal?.aborted) return CANCELLED;
        return { session: null, retryAllowed: true };
      }
      return { session: liaSession ?? null, retryAllowed: true };
    } catch (error) {
      if (signal?.aborted) return CANCELLED;
      console.warn('[sesion-conversaciones] no se pudo restaurar la sesion');
      return { session: null, retryAllowed: false, error };
    }
  }, []);

  const resolveLiaSession = useCallback(async (
    email?: string | null,
    sofiaAccessToken?: string | null,
    signal?: AbortSignal,
  ): Promise<Session | null> => {
    if (signal?.aborted) return null;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return degrade(setSession, setLiaDegraded, setLiaStatusMessage);

    const restored = await syncOptionalLiaSession(normalizedEmail, signal);
    if (signal?.aborted) return null;
    if (restored.session) return accept(restored.session, setSession, setLiaDegraded, setLiaStatusMessage, signal);
    if (!restored.retryAllowed) return degrade(setSession, setLiaDegraded, setLiaStatusMessage);

    try {
      const liaSession = await exchangeSofiaForLiaSession(normalizedEmail, sofiaAccessToken, signal);
      if (signal?.aborted) return null;
      return accept(liaSession, setSession, setLiaDegraded, setLiaStatusMessage, signal);
    } catch {
      if (signal?.aborted) return null;
      console.warn('[sesion-conversaciones] intercambio no disponible');
      return degrade(setSession, setLiaDegraded, setLiaStatusMessage);
    }
  }, [setLiaDegraded, setLiaStatusMessage, setSession, syncOptionalLiaSession]);

  const ensureLiaSession = useCallback((email?: string | null, token?: string | null, signal?: AbortSignal) => {
    const current = pending.current;
    const normalizedEmail = normalizeEmail(email);
    if (current && current.email === normalizedEmail && current.token === token && current.signal === signal) return current.promise;
    const promise = resolveLiaSession(normalizedEmail, token, signal).finally(() => {
      if (pending.current?.promise === promise) pending.current = null;
    });
    pending.current = { email: normalizedEmail, token, signal, promise };
    return promise;
  }, [resolveLiaSession]);

  return { ensureLiaSession, syncOptionalLiaSession };
}

function accept(
  session: Session,
  setSession: (session: Session | null) => void,
  setDegraded: (value: boolean) => void,
  setMessage: (value: string | null) => void,
  signal?: AbortSignal,
): Session {
  setSession(session);
  // La sincronización del perfil es auxiliar; su rechazo no revoca una sesión
  // válida ni deja un rechazo sin manejar. Se inicia una sola vez al aceptar.
  void syncLiaProfile(session).catch(() => {
    if (!signal?.aborted) console.warn('[sesion-conversaciones] no se pudo sincronizar el perfil');
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
