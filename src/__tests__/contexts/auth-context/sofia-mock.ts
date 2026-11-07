import { vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';

let sdkSession: Session | null = null;

export const sofiaMocks = {
  signInWithSofia: vi.fn(),
  signOut: vi.fn(),
  clearLocalProfile: vi.fn(),
  getSession: vi.fn(),
  fetchSofiaUserProfile: vi.fn(),
  onAuthStateChange: vi.fn(),
  setCurrentOrganization: vi.fn(),
  setCurrentTeam: vi.fn(),
};

vi.doMock('../../../services/sofia-auth', () => ({
  sofiaAuth: {
    signInWithSofia: async (...args: unknown[]) => {
      const result = await sofiaMocks.signInWithSofia(...args);
      if (result.success && result.session) sdkSession = result.session;
      return result;
    },
    signOut: async (...args: unknown[]) => {
      const result = await sofiaMocks.signOut(...args);
      sdkSession = null;
      return result;
    },
    getSession: sofiaMocks.getSession,
    clearLocalProfile: sofiaMocks.clearLocalProfile,
    fetchSofiaUserProfile: sofiaMocks.fetchSofiaUserProfile,
    onAuthStateChange: sofiaMocks.onAuthStateChange,
    setCurrentOrganization: sofiaMocks.setCurrentOrganization,
    setCurrentTeam: sofiaMocks.setCurrentTeam,
  },
  SofiaContext: {},
}));

export function resetSofiaMocks(): void {
  // Ver resetSupabaseMocks: las colas de `...Once` sobreviven a clearAllMocks.
  for (const mock of Object.values(sofiaMocks)) mock.mockReset();

  sdkSession = null;
  sofiaMocks.getSession.mockImplementation(async () => sdkSession);
  sofiaMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}
