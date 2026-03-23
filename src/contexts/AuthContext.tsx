import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { Session, AuthChangeEvent, User } from '@supabase/supabase-js';
import { getSupabaseConfigDiagnostics, supabase } from '../lib/supabase';
import { isSofiaConfigured } from '../lib/sofia-client';
import { sofiaAuth, SofiaContext, SofiaAuthResult, SofiaAuthUser } from '../services/sofia-auth';

type AuthUser = SofiaAuthUser | null;
type LiaSessionSyncResult = {
  session: Session | null;
  retryAllowed: boolean;
  error?: unknown;
};

interface AuthContextType {
  session: Session | null;
  user: AuthUser;
  dataUserId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  usingSofia: boolean;
  sofiaContext: SofiaContext | null;
  liaDegraded: boolean;
  liaStatusMessage: string | null;
  signInWithSofia: (email: string, password: string) => Promise<SofiaAuthResult>;
  setCurrentOrganization: (orgId: string) => void;
  setCurrentTeam: (teamId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  dataUserId: null,
  loading: true,
  signOut: async () => {},
  usingSofia: false,
  sofiaContext: null,
  liaDegraded: false,
  liaStatusMessage: null,
  signInWithSofia: async () => ({ success: false, user: null, session: null, error: 'Not initialized' }),
  setCurrentOrganization: () => {},
  setCurrentTeam: () => {},
});

function toAuthUser(user: User, userMetadata?: SofiaAuthUser['user_metadata']): SofiaAuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: userMetadata ?? user.user_metadata,
  };
}

function buildSofiaContext(profile: any): SofiaContext | null {
  const activeMemberships = profile?.memberships?.filter((membership: any) => membership.status === 'active') || [];
  if (activeMemberships.length === 0) {
    return null;
  }

  const activeOrgs = profile?.organizations?.filter((organization: any) =>
    activeMemberships.some((membership: any) => membership.organization_id === organization.id),
  ) || [];
  const activeTeams = profile?.teams?.filter((team: any) =>
    activeMemberships.some((membership: any) => membership.team_id === team.id),
  ) || [];

  return {
    user: profile,
    currentOrganization: activeOrgs[0] || null,
    currentTeam: activeTeams[0] || null,
    organizations: activeOrgs,
    teams: activeTeams,
    memberships: activeMemberships,
  };
}

function normalizeEmail(email?: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

const LIA_CRED_KEY = 'lia-sync-cred';

function storeLiaCredentials(email: string, password: string) {
  try {
    localStorage.setItem(LIA_CRED_KEY, JSON.stringify({ e: email, p: password }));
  } catch { /* ignore */ }
}

function retrieveLiaCredentials(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(LIA_CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.e && parsed?.p ? { email: parsed.e, password: parsed.p } : null;
  } catch {
    return null;
  }
}

function clearLiaCredentials() {
  try { localStorage.removeItem(LIA_CRED_KEY); } catch { /* ignore */ }
}

function buildLiaStatusMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : String(error || '');

  if (/email not confirmed/i.test(rawMessage)) {
    return 'La cuenta de Lia requiere confirmar el correo para poder sincronizar conversaciones.';
  }

  if (/user already registered/i.test(rawMessage)) {
    return 'La cuenta de Lia ya existe, pero esta sesion no pudo abrirla. Cierra sesion e inicia de nuevo para reintentar la sincronizacion.';
  }

  if (/invalid login credentials/i.test(rawMessage)) {
    return 'No se pudo abrir la sesion de Lia con estas credenciales. Cierra sesion e inicia nuevamente para restaurar la sincronizacion.';
  }

  if (/invalid api key/i.test(rawMessage)) {
    const diagnostics = getSupabaseConfigDiagnostics();

    if (diagnostics.runtime && diagnostics.runtime.configError === null && diagnostics.renderer.configError !== null) {
      return 'Lia si esta configurado en runtime, pero esta ventana se inicio con una configuracion vieja o incompleta. Reinicia SofLIA para reconstruir el frontend con la clave correcta.';
    }

    if (
      diagnostics.runtime &&
      diagnostics.renderer.projectRef &&
      diagnostics.runtime.projectRef &&
      diagnostics.renderer.projectRef !== diagnostics.runtime.projectRef
    ) {
      return `El frontend apunta a un proyecto de Lia distinto (${diagnostics.renderer.projectRef}) al que cargo Electron (${diagnostics.runtime.projectRef}). Reinicia SofLIA para alinear la sincronizacion de chats.`;
    }

    if (diagnostics.effective.configError) {
      return `La configuracion de Lia en esta app no es valida: ${diagnostics.effective.configError}. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y reinicia SofLIA.`;
    }

    if (diagnostics.effective.source === 'runtime_env') {
      return 'Supabase rechazo la clave anonima de Lia cargada en runtime para este dispositivo. Verifica que VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY pertenezcan al mismo proyecto.';
    }

    return 'Supabase rechazo la clave anonima de Lia que trae este frontend. Reinicia SofLIA o vuelve a compilar la app para cargar la configuracion correcta.';
  }

  if (rawMessage && rawMessage !== 'null' && rawMessage !== 'undefined') {
    return `No se pudo activar la sincronizacion con Lia: ${rawMessage}`;
  }

  return 'No se pudo activar la sincronizacion con Lia en este dispositivo.';
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [sofiaContext, setSofiaContext] = useState<SofiaContext | null>(null);
  const [liaDegraded, setLiaDegraded] = useState(false);
  const [liaStatusMessage, setLiaStatusMessage] = useState<string | null>(null);

  const usingSofia = isSofiaConfigured();
  const dataUserId = usingSofia ? session?.user?.id ?? null : session?.user?.id ?? user?.id ?? null;

  const clearSessionState = useCallback(() => {
    setSession(null);
    setUser(null);
    setSofiaContext(null);
    setLiaDegraded(false);
    setLiaStatusMessage(null);
  }, []);

  const syncLiaProfile = useCallback(async (liaSession: Session | null) => {
    const liaUser = liaSession?.user;
    if (!liaUser?.id || typeof (supabase as any).from !== 'function') {
      return;
    }

    const metadata = (liaUser.user_metadata || {}) as Record<string, any>;
    const email = normalizeEmail(liaUser.email) || liaUser.email || null;
    const fullName =
      metadata.full_name ||
      metadata.name ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim() ||
      null;
    const avatarUrl = metadata.avatar_url || metadata.picture || null;

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: liaUser.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
        },
        { onConflict: 'id' },
      );

    if (error) {
      console.warn('No se pudo sincronizar el perfil base de Lia:', error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (usingSofia) {
        await sofiaAuth.signOut();
      }

      await supabase.auth.signOut();
    } finally {
      clearLiaCredentials();
      clearSessionState();
    }
  }, [clearSessionState, usingSofia]);

  const resolveSofiaContext = useCallback(async (sofiaUserId: string): Promise<SofiaContext | null> => {
    const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaUserId);
    const nextSofiaContext = buildSofiaContext(profile);

    if (!nextSofiaContext) {
      console.warn('Usuario sin membresias activas en SOFIA.');
      return null;
    }

    return nextSofiaContext;
  }, []);

  const syncOptionalLiaSession = useCallback(async (expectedEmail?: string | null): Promise<LiaSessionSyncResult> => {
    const normalizedExpectedEmail = normalizeEmail(expectedEmail);

    try {
      let { data: { session: liaSession } } = await supabase.auth.getSession();

      // Si no hay sesion en storage, intentar refrescar por si queda un refresh token
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
      if (liaSession) {
        await syncLiaProfile(liaSession);
      }
      return { session: liaSession ?? null, retryAllowed: true };
    } catch (error) {
      console.warn('No se pudo restaurar la sesion opcional de Lia:', error);
      setSession(null);
      return { session: null, retryAllowed: false, error };
    }
  }, [syncLiaProfile]);

  const ensureLiaSession = useCallback(async (email?: string | null, password?: string): Promise<Session | null> => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage('No fue posible obtener las credenciales necesarias para sincronizar conversaciones con Lia.');
      return null;
    }

    const restoredSession = await syncOptionalLiaSession(normalizedEmail);
    if (restoredSession.session) {
      setLiaDegraded(false);
      setLiaStatusMessage(null);
      return restoredSession.session;
    }

    if (!restoredSession.retryAllowed) {
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(restoredSession.error));
      return null;
    }

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInData.session) {
        setSession(signInData.session);
        await syncLiaProfile(signInData.session);
        setLiaDegraded(false);
        setLiaStatusMessage(null);
        return signInData.session;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (signUpData.session) {
        setSession(signUpData.session);
        await syncLiaProfile(signUpData.session);
        setLiaDegraded(false);
        setLiaStatusMessage(null);
        return signUpData.session;
      }

      const resolvedError = signUpError || signInError;
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(resolvedError));
      return null;
    } catch (error) {
      console.warn('No se pudo abrir la sesion de Lia tras autenticar SOFIA:', error);
      setSession(null);
      setLiaDegraded(true);
      setLiaStatusMessage(buildLiaStatusMessage(error));
      return null;
    }
  }, [syncLiaProfile, syncOptionalLiaSession]);

  useEffect(() => {
    const initSession = async () => {
      try {
        if (usingSofia) {
          const sofiaSession = await sofiaAuth.getSession();
          if (!sofiaSession?.user) {
            clearSessionState();
            return;
          }

          const nextSofiaContext = await resolveSofiaContext(sofiaSession.user.id);
          if (!nextSofiaContext) {
            await signOut();
            return;
          }

          setUser(toAuthUser(sofiaSession.user, sofiaSession.user.user_metadata));
          setSofiaContext(nextSofiaContext);
          const liaRestore = await syncOptionalLiaSession(sofiaSession.user.email);
          if (liaRestore.session) {
            setLiaDegraded(false);
            setLiaStatusMessage(null);
          } else {
            // Intentar re-autenticar con credenciales guardadas
            const savedCreds = retrieveLiaCredentials();
            if (savedCreds) {
              const retrySession = await ensureLiaSession(savedCreds.email, savedCreds.password);
              if (retrySession) {
                setLiaDegraded(false);
                setLiaStatusMessage(null);
                return;
              }
            }
            setLiaDegraded(true);
            setLiaStatusMessage(
              liaRestore.error
                ? buildLiaStatusMessage(liaRestore.error)
                : 'No hay una sesion activa de Lia en este dispositivo. Cierra sesion e inicia de nuevo para reactivar la sincronizacion de conversaciones.',
            );
          }
          return;
        }

        const { data: { session: plainSession } } = await supabase.auth.getSession();
        setSession(plainSession);
        setUser(plainSession?.user ? toAuthUser(plainSession.user) : null);
      } catch (error) {
        console.error('Error checking session:', error);
        clearSessionState();
      } finally {
        setLoading(false);
      }
    };

    initSession();

    let unsubscribe: (() => void) | undefined;

    if (usingSofia) {
      const { data: { subscription } } = sofiaAuth.onAuthStateChange(
        async (event, sofiaSession) => {
          console.log('SOFIA Auth state changed:', event);

          if (!sofiaSession?.user) {
            clearSessionState();
            setLoading(false);
            return;
          }

          const nextSofiaContext = await resolveSofiaContext(sofiaSession.user.id);
          if (!nextSofiaContext) {
            await signOut();
            setLoading(false);
            return;
          }

          setUser(toAuthUser(sofiaSession.user, sofiaSession.user.user_metadata));
          setSofiaContext(nextSofiaContext);
          const liaRestore = await syncOptionalLiaSession(sofiaSession.user.email);
          if (liaRestore.session) {
            setLiaDegraded(false);
            setLiaStatusMessage(null);
          } else {
            const savedCreds = retrieveLiaCredentials();
            if (savedCreds) {
              const retrySession = await ensureLiaSession(savedCreds.email, savedCreds.password);
              if (retrySession) {
                setLiaDegraded(false);
                setLiaStatusMessage(null);
                setLoading(false);
                return;
              }
            }
            setLiaDegraded(true);
            setLiaStatusMessage(
              liaRestore.error
                ? buildLiaStatusMessage(liaRestore.error)
                : 'No hay una sesion activa de Lia en este dispositivo. Cierra sesion e inicia de nuevo para reactivar la sincronizacion de conversaciones.',
            );
          }
          setLoading(false);
        },
      );

      unsubscribe = subscription.unsubscribe;
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, nextSession: Session | null) => {
          setSession(nextSession);
          setUser(nextSession?.user ? toAuthUser(nextSession.user) : null);
          if (nextSession) {
            void syncLiaProfile(nextSession);
          }
          setLoading(false);
        },
      );

      unsubscribe = subscription.unsubscribe;
    }

    return () => {
      unsubscribe?.();
    };
  }, [clearSessionState, ensureLiaSession, resolveSofiaContext, signOut, syncLiaProfile, syncOptionalLiaSession, usingSofia]);

  const signInWithSofia = useCallback(async (emailOrUsername: string, password: string): Promise<SofiaAuthResult> => {
    const result = await sofiaAuth.signInWithSofia(emailOrUsername, password);
    if (!result.success || !result.user) {
      return result;
    }

    const nextSofiaContext = result.sofiaProfile ? buildSofiaContext(result.sofiaProfile) : null;
    if (!nextSofiaContext) {
      await signOut();
      return {
        ...result,
        success: false,
        error: 'Acceso denegado: No tienes una membresia activa en SOFIA.',
      };
    }

    setUser(result.user);
    setSofiaContext(nextSofiaContext);
    const liaSession = await ensureLiaSession(result.user.email, password);

    if (liaSession && result.user.email) {
      storeLiaCredentials(result.user.email, password);
    }

    return {
      ...result,
      session: liaSession,
      user: result.user,
    };
  }, [ensureLiaSession, signOut]);

  const setCurrentOrganization = (orgId: string) => {
    if (sofiaContext) {
      const organization = sofiaContext.organizations.find((org) => org.id === orgId);
      if (organization) {
        sofiaAuth.setCurrentOrganization(organization);
        setSofiaContext((prev) => prev ? {
          ...prev,
          currentOrganization: organization,
          currentTeam: prev.teams.find((team) => team.organization_id === organization.id) || null,
        } : null);
      }
    }
  };

  const setCurrentTeam = (teamId: string) => {
    if (sofiaContext) {
      const team = sofiaContext.teams.find((item) => item.id === teamId);
      if (team) {
        sofiaAuth.setCurrentTeam(team);
        setSofiaContext((prev) => prev ? { ...prev, currentTeam: team } : null);
      }
    }
  };

  const value = {
    session,
    user,
    dataUserId,
    loading,
    signOut,
    usingSofia,
    sofiaContext,
    liaDegraded,
    liaStatusMessage,
    signInWithSofia,
    setCurrentOrganization,
    setCurrentTeam,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
