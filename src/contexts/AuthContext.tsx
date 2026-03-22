import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import type { Session, AuthChangeEvent, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isSofiaConfigured } from '../lib/sofia-client';
import { sofiaAuth, SofiaContext, SofiaAuthResult, SofiaAuthUser } from '../services/sofia-auth';

type AuthUser = SofiaAuthUser | null;

interface AuthContextType {
  session: Session | null;
  user: AuthUser;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [sofiaContext, setSofiaContext] = useState<SofiaContext | null>(null);
  const [liaDegraded, setLiaDegraded] = useState(false);
  const [liaStatusMessage, setLiaStatusMessage] = useState<string | null>(null);

  const usingSofia = isSofiaConfigured();

  const clearSessionState = useCallback(() => {
    setSession(null);
    setUser(null);
    setSofiaContext(null);
    setLiaDegraded(false);
    setLiaStatusMessage(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (usingSofia) {
        await sofiaAuth.signOut();
      }

      await supabase.auth.signOut();
    } finally {
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

  const syncOptionalLiaSession = useCallback(async () => {
    try {
      const { data: { session: liaSession } } = await supabase.auth.getSession();
      setSession(liaSession ?? null);
      return liaSession ?? null;
    } catch (error) {
      console.warn('No se pudo restaurar la sesion opcional de Lia:', error);
      setSession(null);
      return null;
    }
  }, []);

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
          setLiaDegraded(false);
          setLiaStatusMessage(null);
          await syncOptionalLiaSession();
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
          setLiaDegraded(false);
          setLiaStatusMessage(null);
          await syncOptionalLiaSession();
          setLoading(false);
        },
      );

      unsubscribe = subscription.unsubscribe;
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, nextSession: Session | null) => {
          setSession(nextSession);
          setUser(nextSession?.user ? toAuthUser(nextSession.user) : null);
          setLoading(false);
        },
      );

      unsubscribe = subscription.unsubscribe;
    }

    return () => {
      unsubscribe?.();
    };
  }, [clearSessionState, resolveSofiaContext, signOut, syncOptionalLiaSession, usingSofia]);

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
    setLiaDegraded(false);
    setLiaStatusMessage(null);
    const liaSession = await syncOptionalLiaSession();

    return {
      ...result,
      session: liaSession,
      user: result.user,
    };
  }, [signOut, syncOptionalLiaSession]);

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
