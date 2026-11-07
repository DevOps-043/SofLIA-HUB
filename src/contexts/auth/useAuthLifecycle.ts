import { useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { sofiaAuth, type SofiaContext } from '../../services/sofia-auth';
import { syncLiaProfile } from './lia-profile';
import { SOFIA_CONTEXT_DEGRADED_MESSAGE, SOFIA_SESSION_EXPIRED_MESSAGE, toAuthUser } from './helpers';
import type { AuthUser, SofiaContextIssue, SofiaContextResolution } from './types';
import type { AuthOperations } from './auth-operations';

type AuthLifecycleDeps = {
  operations: AuthOperations;
  usingSofia: boolean;
  clearSessionState: () => void;
  ensureLiaSession: (email?: string | null, sofiaAccessToken?: string | null, signal?: AbortSignal) => Promise<Session | null>;
  resolveSofiaContext: (sofiaUserId: string, signal?: AbortSignal) => Promise<SofiaContextResolution>;
  signOut: () => Promise<void>;
  setLoading: (value: boolean) => void;
  setSofiaContextIssue: (value: SofiaContextIssue | null) => void;
  setSession: (value: Session | null) => void;
  setSofiaSession: (value: Session | null) => void;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
};

export function useAuthLifecycle(deps: AuthLifecycleDeps): void {
  useEffect(() => {
    let operation = new AbortController();
    let disposed = false;
    let eventObserved = false;
    let subject: string | null | undefined;
    let unsubscribe: (() => void) | undefined;
    let releaseScope = () => {};
    const linkScope = () => {
      releaseScope();
      const globalSignal = deps.operations.capture();
      const currentOperation = operation;
      const abort = () => currentOperation.abort();
      if (globalSignal.aborted) abort();
      else globalSignal.addEventListener('abort', abort, { once: true });
      releaseScope = () => globalSignal.removeEventListener('abort', abort);
    };
    linkScope();

    // Cada continuación conserva su señal; A/B/A nunca rehabilita la de A.
    const run = async (signal: AbortSignal, work: () => Promise<void>) => {
      if (signal.aborted) return;
      try {
        await work();
      } catch {
        if (signal.aborted) return;
        console.error('[autenticacion] no se pudo restaurar la sesion');
        deps.clearSessionState();
      } finally {
        if (!signal.aborted) deps.setLoading(false);
      }
    };

    const apply = async (session: Session | null, signal: AbortSignal) => {
      if (signal.aborted) return;
      if (!deps.operations.adopt(deps.operations.capture(), session?.user?.id ?? null)) return;
      if (!deps.usingSofia) {
        deps.setSession(session);
        deps.setUser(session?.user ? toAuthUser(session.user) : null);
        if (session) void syncLiaProfile(session).catch(() => {
          if (!signal.aborted) console.warn('[autenticacion] no se pudo sincronizar el perfil');
        });
        return;
      }
      const nextSubject = session?.user?.id ?? null;
      if (subject !== nextSubject) {
        subject = nextSubject;
        deps.clearSessionState();
        if (nextSubject) deps.setLoading(true);
      }
      if (!session?.user) return;
      await applySofiaSession(session, deps, signal);
    };

    try {
      const source = deps.usingSofia ? sofiaAuth : supabase.auth;
      const { data: { subscription } } = source.onAuthStateChange((event, session) => {
        if (disposed || event === 'INITIAL_SESSION' && eventObserved) return;
        eventObserved = true;
        if (!deps.operations.observe(event, event === 'SIGNED_OUT' ? null : session?.user?.id ?? null)) return;
        operation.abort();
        operation = new AbortController();
        linkScope();
        const signal = operation.signal;
        // El cierre limpia inmediatamente; la resolución asíncrona se agenda
        // fuera del callback para no retener el lock Auth del SDK.
        if (event === 'SIGNED_OUT' || !session?.user) {
          subject = null;
          deps.clearSessionState();
          deps.setLoading(false);
          return;
        }
        if (deps.usingSofia && subject !== session.user.id) {
          subject = session.user.id;
          deps.clearSessionState();
          deps.setLoading(true);
        }
        void Promise.resolve().then(() => run(signal, () => apply(session, signal)));
      });
      unsubscribe = () => subscription.unsubscribe();
      if (!eventObserved && deps.operations.canRestore()) {
        const signal = operation.signal;
        void run(signal, async () => {
          const session = deps.usingSofia
            ? await sofiaAuth.getSession()
            : (await supabase.auth.getSession()).data.session;
          await apply(session, signal);
        });
      }
    } catch {
      disposed = true;
      console.error('[autenticacion] no se pudo suscribir a la sesion');
      operation.abort();
      deps.clearSessionState();
      deps.setLoading(false);
    }

    return () => {
      disposed = true;
      operation.abort();
      releaseScope();
      try { unsubscribe?.(); } catch {
        console.warn('[autenticacion] no se pudo liberar la suscripcion');
      }
    };
    // Se depende de funciones estables, no de deps, recreado en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deps.clearSessionState,
    deps.ensureLiaSession,
    deps.resolveSofiaContext,
    deps.signOut,
    deps.usingSofia,
    deps.operations,
  ]);
}

async function applySofiaSession(session: Session, deps: AuthLifecycleDeps, signal: AbortSignal): Promise<void> {
  const resolution = await deps.resolveSofiaContext(session.user.id, signal);
  if (signal.aborted) return;
  if (resolution.status === 'denied') {
    await deps.signOut();
    return;
  }

  deps.setUser(toAuthUser(session.user, session.user.user_metadata));
  deps.setSofiaSession(session);
  if (resolution.status === 'ok') {
    deps.setSofiaContext(resolution.context);
    deps.setSofiaContextIssue(null);
  } else {
    // El directorio puede degradarse sin descartar la identidad ni Lia.
    deps.setSofiaContextIssue(session.access_token
      ? { message: SOFIA_CONTEXT_DEGRADED_MESSAGE, retryable: true }
      : { message: SOFIA_SESSION_EXPIRED_MESSAGE, retryable: false });
  }
  await deps.ensureLiaSession(session.user.email, session.access_token, signal);
}
