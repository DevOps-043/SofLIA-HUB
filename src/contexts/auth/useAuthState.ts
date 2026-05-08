import { useCallback, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SofiaContext } from '../../services/sofia-auth';
import type { AuthUser } from './types';

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [sofiaContext, setSofiaContext] = useState<SofiaContext | null>(null);
  const [liaDegraded, setLiaDegraded] = useState(false);
  const [liaStatusMessage, setLiaStatusMessage] = useState<string | null>(null);

  const clearSessionState = useCallback(() => {
    setSession(null);
    setUser(null);
    setSofiaContext(null);
    setLiaDegraded(false);
    setLiaStatusMessage(null);
  }, []);

  return {
    session,
    setSession,
    user,
    setUser,
    loading,
    setLoading,
    sofiaContext,
    setSofiaContext,
    liaDegraded,
    setLiaDegraded,
    liaStatusMessage,
    setLiaStatusMessage,
    clearSessionState,
  };
}
