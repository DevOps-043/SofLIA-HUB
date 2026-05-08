import './sofia-mock';
import './supabase-mock';
import React from 'react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { resetSofiaMocks, sofiaMocks } from './sofia-mock';
import { resetSupabaseMocks, supabaseMocks } from './supabase-mock';

export { sofiaMocks, supabaseMocks, useAuth };

export function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
}

export function resetAuthMocks(): void {
  vi.clearAllMocks();
  resetSofiaMocks();
  resetSupabaseMocks();
}

export function createSofiaSignInPayload() {
  return {
    success: true,
    user: { id: 'sofia-user-1', email: 'test@soflia.com', user_metadata: { first_name: 'Test' } },
    session: { access_token: 'token' },
    sofiaProfile: {
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      memberships: [{ status: 'active', organization_id: 'org-1', team_id: 'team-1' }],
      organizations: [{ id: 'org-1', name: 'TestOrg' }],
      teams: [{ id: 'team-1', name: 'TestTeam', organization_id: 'org-1' }],
    },
  };
}
