import React, { createContext, useState, useEffect, useContext } from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
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
  signInWithSofia: async () => ({ success: false, user: null, session: null, error: 'Not initialized' }),
  setCurrentOrganization: () => {},
  setCurrentTeam: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);
  const [sofiaContext, setSofiaContext] = useState<SofiaContext | null>(null);

  const usingSofia = isSofiaConfigured();

  useEffect(() => {
    const initSession = async () => {
      try {
        if (usingSofia) {
          const sofiaSession = await sofiaAuth.getSession();
          if (sofiaSession) {
            const { data: { session: liaSession } } = await supabase.auth.getSession();

            if (liaSession) {
              setSession(liaSession);
              setUser({
                id: liaSession.user.id,
                email: liaSession.user.email,
                user_metadata: sofiaSession.user.user_metadata
              });

              const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaSession.user.id);
              if (profile) {
                setSofiaContext({
                  user: profile,
                  currentOrganization: profile.organizations?.[0] || null,
                  currentTeam: profile.teams?.[0] || null,
                  organizations: profile.organizations || [],
                  teams: profile.teams || [],
                  memberships: profile.memberships || []
                });
              }
            } else {
              // SOFIA session exists but no Lia session - use SOFIA user directly
              setUser({
                id: sofiaSession.user.id,
                email: sofiaSession.user.email,
                user_metadata: sofiaSession.user.user_metadata
              });

              const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaSession.user.id);
              if (profile) {
                setSofiaContext({
                  user: profile,
                  currentOrganization: profile.organizations?.[0] || null,
                  currentTeam: profile.teams?.[0] || null,
                  organizations: profile.organizations || [],
                  teams: profile.teams || [],
                  memberships: profile.memberships || []
                });
              }
            }
          }
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ? {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata
          } : null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
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
          
          if (sofiaSession?.user) {
            // Check for Lia session to get the correct database ID
            const { data: { session: liaSession } } = await supabase.auth.getSession();
            
            const principalUser = {
              id: liaSession?.user?.id || sofiaSession.user.id,
              email: sofiaSession.user.email,
              user_metadata: sofiaSession.user.user_metadata
            };

            setSession(liaSession || sofiaSession);
            setUser(principalUser);

            const profile = await sofiaAuth.fetchSofiaUserProfile(sofiaSession.user.id);
            if (profile) {
              setSofiaContext({
                user: profile,
                currentOrganization: profile.organizations?.[0] || null,
                currentTeam: profile.teams?.[0] || null,
                organizations: profile.organizations || [],
                teams: profile.teams || [],
                memberships: profile.memberships || []
              });
            }
          } else {
            setSession(null);
            setUser(null);
            setSofiaContext(null);
          }

          setLoading(false);
        }
      );
      unsubscribe = subscription.unsubscribe;
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          setSession(session);
          setUser(session?.user ? {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata
          } : null);
          setLoading(false);
        }
      );
      unsubscribe = subscription.unsubscribe;
    }

    return () => {
      unsubscribe?.();
    };
  }, [usingSofia]);

  const signOut = async () => {
    if (usingSofia) {
      await sofiaAuth.signOut();
      setSofiaContext(null);
      setUser(null);
      setSession(null);
    }
    await supabase.auth.signOut();
  };

  const signInWithSofia = async (emailOrUsername: string, password: string): Promise<SofiaAuthResult> => {
    const result = await sofiaAuth.signInWithSofia(emailOrUsername, password);

    if (result.success && result.user) {
      const sofiaEmail = result.user.email || result.sofiaProfile?.email;
      if (sofiaEmail) {
        try {
          const { data: liaAuth, error: liaError } = await supabase.auth.signInWithPassword({
            email: sofiaEmail,
            password: password
          });

          if (liaError) {
            console.log('Usuario no existe en Lia, creando...', liaError.message);
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: sofiaEmail,
              password: password,
              options: {
                data: {
                  full_name: result.sofiaProfile?.full_name || result.user.user_metadata?.first_name,
                  sofia_user_id: result.user.id
                }
              }
            });

            if (signUpError) {
              console.error('Error creando usuario en Lia:', signUpError);
              setUser(result.user);
            } else if (signUpData.session) {
              setSession(signUpData.session);
              setUser({
                id: signUpData.user!.id,
                email: sofiaEmail,
                user_metadata: result.user.user_metadata
              });
            } else {
              setUser(result.user);
            }
          } else if (liaAuth.session) {
            setSession(liaAuth.session);
            setUser({
              id: liaAuth.user!.id,
              email: sofiaEmail,
              user_metadata: result.user.user_metadata
            });
          }
        } catch (err) {
          console.error('Error sincronizando con Lia Supabase:', err);
          setUser(result.user);
        }
      } else {
        setUser(result.user);
      }

      if (result.sofiaProfile) {
        setSofiaContext({
          user: result.sofiaProfile,
          currentOrganization: result.sofiaProfile.organizations?.[0] || null,
          currentTeam: result.sofiaProfile.teams?.[0] || null,
          organizations: result.sofiaProfile.organizations || [],
          teams: result.sofiaProfile.teams || [],
          memberships: result.sofiaProfile.memberships || []
        });
      }
    }

    return result;
  };

  const setCurrentOrganization = (orgId: string) => {
    if (sofiaContext) {
      const org = sofiaContext.organizations.find(o => o.id === orgId);
      if (org) {
        sofiaAuth.setCurrentOrganization(org);
        setSofiaContext(prev => prev ? {
          ...prev,
          currentOrganization: org,
          currentTeam: prev.teams.find(t => t.organization_id === org.id) || null
        } : null);
      }
    }
  };

  const setCurrentTeam = (teamId: string) => {
    if (sofiaContext) {
      const team = sofiaContext.teams.find(t => t.id === teamId);
      if (team) {
        sofiaAuth.setCurrentTeam(team);
        setSofiaContext(prev => prev ? { ...prev, currentTeam: team } : null);
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
    signInWithSofia,
    setCurrentOrganization,
    setCurrentTeam,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
