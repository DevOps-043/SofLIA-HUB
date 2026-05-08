import { vi } from 'vitest';

export const sofiaMocks = {
  signInWithSofia: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  fetchSofiaUserProfile: vi.fn(),
  onAuthStateChange: vi.fn(),
  setCurrentOrganization: vi.fn(),
  setCurrentTeam: vi.fn(),
};

vi.doMock('../../../services/sofia-auth', () => ({
  sofiaAuth: {
    signInWithSofia: sofiaMocks.signInWithSofia,
    signOut: sofiaMocks.signOut,
    getSession: sofiaMocks.getSession,
    fetchSofiaUserProfile: sofiaMocks.fetchSofiaUserProfile,
    onAuthStateChange: sofiaMocks.onAuthStateChange,
    setCurrentOrganization: sofiaMocks.setCurrentOrganization,
    setCurrentTeam: sofiaMocks.setCurrentTeam,
  },
  SofiaContext: {},
}));

export function resetSofiaMocks(): void {
  sofiaMocks.getSession.mockResolvedValue(null);
  sofiaMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}
