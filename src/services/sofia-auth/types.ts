import type { Session } from '@supabase/supabase-js';

import type {
  SofiaOrganization,
  SofiaOrganizationUser,
  SofiaTeam,
  SofiaUserProfile,
} from '../../lib/sofia-client';

export interface SofiaAuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

export interface SofiaAuthResult {
  success: boolean;
  user: SofiaAuthUser | null;
  session: Session | null;
  error?: string;
  sofiaProfile?: SofiaUserProfile | null;
}

export interface SofiaContext {
  user: SofiaUserProfile | null;
  currentOrganization: SofiaOrganization | null;
  currentTeam: SofiaTeam | null;
  organizations: SofiaOrganization[];
  teams: SofiaTeam[];
  memberships: SofiaOrganizationUser[];
}
