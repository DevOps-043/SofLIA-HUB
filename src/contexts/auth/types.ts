import type { Session } from '@supabase/supabase-js';
import type { SofiaAuthResult, SofiaAuthUser, SofiaContext } from '../../services/sofia-auth';

export type AuthUser = SofiaAuthUser | null;

export type LiaSessionSyncResult = {
  session: Session | null;
  retryAllowed: boolean;
  error?: unknown;
};

export interface AuthContextType {
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
