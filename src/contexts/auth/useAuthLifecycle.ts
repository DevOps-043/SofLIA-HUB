import { useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { sofiaAuth, type SofiaContext } from '../../services/sofia-auth';
import { applyLiaRestore } from './lia-recovery';
import { syncLiaProfile } from './lia-profile';
import { toAuthUser } from './helpers';
import type { AuthUser, LiaSessionSyncResult } from './types';

type AuthLifecycleDeps = {
  usingSofia: boolean;
  clearSessionState: () => void;
  ensureLiaSession: (email?: string | null, password?: string) => Promise<Session | null>;
  resolveSofiaContext: (sofiaUserId: string) => Promise<SofiaContext | null>;
  signOut: () => Promise<void>;
  syncOptionalLiaSession: (expectedEmail?: string | null) => Promise<LiaSessionSyncResult>;
  setLiaDegraded: (value: boolean) => void;
  setLiaStatusMessage: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setSession: (value: Session | null) => void;
  setSofiaContext: (value: SofiaContext | null) => void;
  setUser: (value: AuthUser) => void;
};

export function useAuthLifecycle(deps: AuthLifecycleDeps): void {
  useEffect(() => {
    const initSession = async () => {
      try {
        if (deps.usingSofia) return await initializeSofiaSession(deps);
        const { data: { session } } = await supabase.auth.getSession();
        deps.setSession(session);
        deps.setUser(session?.user ? toAuthUser(session.user) : null);
      } catch (error) {
        console.error('Error checking session:', error);
        deps.clearSessionState();
      } finally {
        deps.setLoading(false);
      }
    };

    void initSession();
    const unsubscribe = deps.usingSofia ? subscribeSofia(deps) : subscribeLia(deps);
    return () => unsubscribe?.();
  }, [
    deps.clearSessionState,
    deps.ensureLiaSession,
    deps.resolveSofiaContext,
    deps.signOut,
    deps.syncOptionalLiaSession,
    deps.usingSofia,
  ]);
}

async function initializeSofiaSession(deps: AuthLifecycleDeps): Promise<void> {
  const sofiaSession = await sofiaAuth.getSession();
  if (!sofiaSession?.user) return deps.clearSessionState();
  await applySofiaSession(sofiaSession, deps, false);
}

function subscribeSofia(deps: AuthLifecycleDeps): (() => void) | undefined {
  const { data: { subscription } } = sofiaAuth.onAuthStateChange(async (event, sofiaSession) => {
    console.log('SOFIA Auth state changed:', event);
    if (!sofiaSession?.user) {
      deps.clearSessionState();
      deps.setLoading(false);
      return;
    }
    await applySofiaSession(sofiaSession, deps, true);
  });
  return subscription.unsubscribe;
}

function subscribeLia(deps: AuthLifecycleDeps): (() => void) | undefined {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
    deps.setSession(session);
    deps.setUser(session?.user ? toAuthUser(session.user) : null);
    if (session) void syncLiaProfile(session);
    deps.setLoading(false);
  });
  return subscription.unsubscribe;
}

async function applySofiaSession(sofiaSession: any, deps: AuthLifecycleDeps, finishLoading: boolean): Promise<void> {
  const nextContext = await deps.resolveSofiaContext(sofiaSession.user.id);
  if (!nextContext) {
    await deps.signOut();
    if (finishLoading) deps.setLoading(false);
    return;
  }
  deps.setUser(toAuthUser(sofiaSession.user, sofiaSession.user.user_metadata));
  deps.setSofiaContext(nextContext);
  const liaRestore = await deps.syncOptionalLiaSession(sofiaSession.user.email);
  const recovered = await applyLiaRestore(liaRestore, deps);
  if (finishLoading || recovered) deps.setLoading(false);
}
