import { useCallback, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { SofiaContext } from '../../services/sofia-auth';
import type { AuthUser, SofiaContextIssue } from './types';

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [sofiaContext, setSofiaContext] = useState<SofiaContext | null>(null);
  const [liaDegraded, setLiaDegraded] = useState(false);
  const [liaStatusMessage, setLiaStatusMessage] = useState<string | null>(null);
  // El directorio de SOFIA (organizaciones y equipos) se degrada por separado de
  // las conversaciones: que no responda no debe borrar los chats de Lia. Se
  // guarda la causa y no un booleano porque una caida transitoria se reintenta
  // sola y una sesion caducada no: solo la primera admite reintento.
  const [sofiaContextIssue, setSofiaContextIssue] = useState<SofiaContextIssue | null>(null);

  const clearSessionState = useCallback(() => {
    setSession(null);
    setUser(null);
    setSofiaContext(null);
    setLiaDegraded(false);
    setLiaStatusMessage(null);
    setSofiaContextIssue(null);
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
    sofiaContextIssue,
    setSofiaContextIssue,
    clearSessionState,
  };
}
