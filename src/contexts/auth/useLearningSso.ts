import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sofiaAuth, type SofiaAuthResult, type SofiaContext } from '../../services/sofia-auth';
import {
  consumePendingLearningSsoCallback,
  createLearningSsoRequest,
  exchangeTicketForSofiaSession,
  isLearningSsoAvailable,
  LearningSsoError,
  openLearningSso,
  subscribeToLearningSsoCallback,
  type LearningSsoCallback,
} from '../../services/learning-sso';
import { buildSofiaContext } from './helpers';
import type { AuthUser } from './types';

type LearningSsoDeps = {
  ensureLiaSession: (email?: string | null, sofiaAccessToken?: string | null) => Promise<Session | null>;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
  signOut: () => Promise<void>;
};

export const SSO_GENERIC_ERROR = 'No pudimos completar el inicio de sesion. Intenta nuevamente.';
export const SSO_DENIED_ERROR = 'Acceso denegado: no tienes una membresia activa en SOFIA.';

/**
 * Orquesta el inicio de sesion federado con SofLIA Learning.
 *
 * El verificador vive aqui, en memoria del renderer, junto al `state` de la
 * solicitud viva. Un retorno cuyo `state` no coincida se descarta sin tocar la
 * sesion: es lo que impide que un deep link ajeno arrastre a la aplicacion a un
 * canje que nadie pidio.
 */
export function useLearningSso({ ensureLiaSession, setSofiaContext, setUser, signOut }: LearningSsoDeps) {
  const [ssoPending, setSsoPending] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  // Ref y no estado: el suscriptor al deep link se registra una sola vez y debe
  // leer siempre la solicitud vigente.
  const pendingRequest = useRef<{ state: string; codeVerifier: string } | null>(null);
  const available = isLearningSsoAvailable();

  const completeCallback = useCallback(async (payload: LearningSsoCallback): Promise<SofiaAuthResult | null> => {
    const request = pendingRequest.current;
    // Retorno sin solicitud viva o con otra correlacion: se ignora por completo.
    if (!request || payload?.state !== request.state) return null;

    pendingRequest.current = null;

    if (payload.error || !payload.ticket) {
      setSsoPending(false);
      setSsoError(payload.error === 'access_denied' ? SSO_DENIED_ERROR : SSO_GENERIC_ERROR);
      return null;
    }

    try {
      const session = await exchangeTicketForSofiaSession(payload.ticket, request.codeVerifier);
      const result = await sofiaAuth.completeSofiaSsoSession(session);

      if (!result.success || !result.user) {
        setSsoError(result.error || SSO_GENERIC_ERROR);
        return result;
      }

      const nextSofiaContext = result.sofiaProfile ? buildSofiaContext(result.sofiaProfile) : null;
      if (!nextSofiaContext) {
        await signOut();
        setSsoError(SSO_DENIED_ERROR);
        return { ...result, success: false, error: SSO_DENIED_ERROR };
      }

      setUser(result.user);
      setSofiaContext(nextSofiaContext);
      const liaSession = await ensureLiaSession(result.user.email, result.session?.access_token);
      setSsoError(null);
      return { ...result, session: liaSession, user: result.user };
    } catch (error) {
      const code = error instanceof LearningSsoError ? error.code : null;
      setSsoError(code === 'access_denied' ? SSO_DENIED_ERROR : SSO_GENERIC_ERROR);
      return null;
    } finally {
      setSsoPending(false);
    }
  }, [ensureLiaSession, setSofiaContext, setUser, signOut]);

  useEffect(() => {
    if (!available) return;

    const unsubscribe = subscribeToLearningSsoCallback((payload) => { void completeCallback(payload); });

    // Arranque en frio: la aplicacion pudo abrirse por el propio deep link.
    void consumePendingLearningSsoCallback().then((payload) => {
      if (payload) void completeCallback(payload);
    });

    return unsubscribe;
  }, [available, completeCallback]);

  const signInWithLearningSso = useCallback(async (): Promise<void> => {
    if (!available) return;

    setSsoError(null);
    setSsoPending(true);
    try {
      const request = await createLearningSsoRequest();
      pendingRequest.current = { codeVerifier: request.codeVerifier, state: request.state };
      await openLearningSso(request);
    } catch {
      pendingRequest.current = null;
      setSsoPending(false);
      setSsoError(SSO_GENERIC_ERROR);
    }
  }, [available]);

  /** Permite salir del estado de espera si el usuario abandono el navegador. */
  const cancelLearningSso = useCallback(() => {
    pendingRequest.current = null;
    setSsoPending(false);
    setSsoError(null);
  }, []);

  return {
    learningSsoAvailable: available,
    signInWithLearningSso,
    cancelLearningSso,
    ssoPending,
    ssoError,
  };
}
