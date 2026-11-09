import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sofiaAuth, type SofiaAuthResult, type SofiaContext } from '../../services/sofia-auth';
import {
  consumePendingLearningSsoCallback, createLearningSsoRequest, exchangeTicketForSofiaSession,
  isLearningSsoAvailable, LearningSsoError, openLearningSso, subscribeToLearningSsoCallback,
  type LearningSsoCallback, type LearningSsoRequest,
} from '../../services/learning-sso';
import { buildSofiaContext } from './helpers';
import type { AuthUser } from './types';
import type { AuthIntent, AuthOperations } from './auth-operations';

type LearningSsoDeps = {
  operations: AuthOperations;
  setLoading: (value: boolean) => void;
  ensureLiaSession: (email?: string | null, sofiaAccessToken?: string | null, signal?: AbortSignal) => Promise<Session | null>;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
  setSofiaSession: (value: Session | null) => void;
  signOut: () => Promise<void>;
};
type PendingSso = {
  intent: AuthIntent;
  request?: LearningSsoRequest;
  claimed: boolean;
  release: () => void;
};

export const SSO_GENERIC_ERROR = 'No pudimos completar el inicio de sesion. Intenta nuevamente.';
export const SSO_DENIED_ERROR = 'Acceso denegado: no tienes una membresia activa en SOFIA.';

/** state/verificador y ownership permanecen vivos también durante el canje. */
export function useLearningSso({ operations, setLoading, ensureLiaSession, setSofiaContext, setUser, setSofiaSession, signOut }: LearningSsoDeps) {
  const [ssoPending, setSsoPending] = useState(false);
  const [pendingSignal, setPendingSignal] = useState<AbortSignal | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const pendingRequest = useRef<PendingSso | null>(null);
  const available = isLearningSsoAvailable();
  const isLive = useCallback((value: PendingSso) =>
    pendingRequest.current === value && operations.isCurrent(value.intent.signal), [operations]);

  const retire = useCallback((value: PendingSso) => {
    value.release();
    if (pendingRequest.current !== value) return;
    pendingRequest.current = null;
    setSsoPending(false);
  }, []);

  const completeCallback = useCallback(async (payload: LearningSsoCallback): Promise<SofiaAuthResult | null> => {
    const live = pendingRequest.current;
    if (!live || !isLive(live) || live.claimed || !live.request || payload?.state !== live.request.state) return null;
    live.claimed = true;
    if (payload.error || !payload.ticket) {
      setSsoError(payload.error === 'access_denied' ? SSO_DENIED_ERROR : SSO_GENERIC_ERROR);
      retire(live); operations.finish(live.intent);
      return null;
    }

    let denied = false;
    try {
      const result = await operations.enqueue(live.intent.signal, async () => {
        const session = await exchangeTicketForSofiaSession(payload.ticket!, live.request!.codeVerifier, live.intent.signal);
        if (!isLive(live)) return null;
        const response = await sofiaAuth.completeSofiaSsoSession(session, live.intent.signal);
        if (!isLive(live)) return null;
        if (!response.success || !response.user) {
          setSsoError(response.error || SSO_GENERIC_ERROR);
          return response;
        }
        if (!operations.adopt(live.intent.signal, session.user.id)) {
          operations.cancel(live.intent.signal);
          return null;
        }
        const nextContext = response.sofiaProfile ? buildSofiaContext(response.sofiaProfile) : null;
        if (!nextContext) { denied = true; return null; }
        setUser(response.user);
        setSofiaSession(session);
        setSofiaContext(nextContext);
        const liaSession = await ensureLiaSession(session.user.email, session.access_token, live.intent.signal);
        if (!isLive(live)) return null;
        setSsoError(null);
        return { ...response, session: liaSession, user: response.user };
      });
      if (denied && isLive(live)) {
        setSsoError(SSO_DENIED_ERROR);
        retire(live); operations.finish(live.intent);
        await signOut();
      }
      return result;
    } catch (error) {
      if (!isLive(live)) return null;
      const code = error instanceof LearningSsoError ? error.code : null;
      setSsoError(code === 'access_denied' ? SSO_DENIED_ERROR : SSO_GENERIC_ERROR);
      return null;
    } finally {
      if (isLive(live)) {
        setLoading(false);
        retire(live);
        operations.finish(live.intent);
      }
    }
  }, [operations, isLive, retire, setLoading, ensureLiaSession, setSofiaContext, setUser, setSofiaSession, signOut]);

  useEffect(() => {
    if (!available) return;
    let mounted = true;
    const unsubscribe = subscribeToLearningSsoCallback(payload => { void completeCallback(payload); });
    void consumePendingLearningSsoCallback().then(payload => {
      if (mounted && payload) void completeCallback(payload);
    }).catch(() => {
      if (mounted) console.warn('[sso-learning] no se pudo recuperar el retorno pendiente');
    });
    return () => {
      mounted = false;
      const live = pendingRequest.current;
      if (live) { live.release(); pendingRequest.current = null; operations.cancel(live.intent.signal); }
      unsubscribe();
    };
  }, [available, completeCallback, operations]);

  const signInWithLearningSso = useCallback(async (): Promise<void> => {
    if (!available) return;
    const live: PendingSso = { intent: operations.begin('sso'), claimed: false, release: () => undefined };
    if (!operations.isCurrent(live.intent.signal)) return;
    const cancel = () => { if (pendingRequest.current === live) pendingRequest.current = null; };
    live.intent.signal.addEventListener('abort', cancel, { once: true });
    live.release = () => live.intent.signal.removeEventListener('abort', cancel);
    pendingRequest.current = live;
    setLoading(false); setSsoError(null); setSsoPending(true); setPendingSignal(live.intent.signal);
    try {
      await operations.enqueue(live.intent.signal, async () => {
        const request = await createLearningSsoRequest();
        if (!isLive(live)) return;
        live.request = request;
        await openLearningSso(request);
      });
    } catch {
      if (!isLive(live)) return;
      setSsoError(SSO_GENERIC_ERROR);
      retire(live); operations.finish(live.intent);
    }
  }, [available, operations, isLive, retire, setLoading]);

  const cancelLearningSso = useCallback(() => {
    const live = pendingRequest.current;
    if (live) {
      live.release(); pendingRequest.current = null;
      operations.cancel(live.intent.signal);
    }
    setSsoPending(false); setSsoError(null);
  }, [operations]);

  return { learningSsoAvailable: available, signInWithLearningSso, cancelLearningSso,
    ssoPending: ssoPending && Boolean(pendingSignal && operations.isCurrent(pendingSignal)), ssoError };
}
