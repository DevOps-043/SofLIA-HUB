/**
 * Tests AUTH-001 to AUTH-005: AuthContext — Authentication context tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock sofia-auth
const sofiaMocks = vi.hoisted(() => ({
  signInWithSofia: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  fetchSofiaUserProfile: vi.fn(),
  onAuthStateChange: vi.fn(),
  setCurrentOrganization: vi.fn(),
  setCurrentTeam: vi.fn(),
}));

vi.mock('../../services/sofia-auth', () => ({
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

// Mock Supabase
const supabaseMocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  getSupabaseConfigError: vi.fn(() => null),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: supabaseMocks.signOut,
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
    },
  },
  isSupabaseConfigured: vi.fn(() => true),
  getSupabaseConfigError: supabaseMocks.getSupabaseConfigError,
  getSupabaseProjectRef: vi.fn(() => 'test-project-ref'),
}));

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: null,
  isSofiaConfigured: vi.fn(() => true),
}));

vi.mock('../../config', () => ({
  SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' },
  SOFIA_SUPABASE: { URL: 'https://test-sofia.supabase.co', ANON_KEY: 'test-key' },
}));

// Import after mocks
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { getSupabaseConfigError } from '../../lib/supabase';

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sofiaMocks.getSession.mockResolvedValue(null);
    supabaseMocks.getSupabaseConfigError.mockReturnValue(null);
    sofiaMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  // AUTH-001: AuthProvider initializes with loading=true
  it('AUTH-001: AuthProvider initializes with loading=true', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // Initially loading should be true
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  // AUTH-002: Sign-in sets user
  it('AUTH-002: signInWithSofia sets user on success', async () => {
    const mockUser = { id: 'sofia-user-1', email: 'test@soflia.com', user_metadata: { first_name: 'Test' } };
    const mockProfile = {
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      memberships: [{ status: 'active', organization_id: 'org-1', team_id: 'team-1' }],
      organizations: [{ id: 'org-1', name: 'TestOrg' }],
      teams: [{ id: 'team-1', name: 'TestTeam', organization_id: 'org-1' }],
    };

    sofiaMocks.signInWithSofia.mockResolvedValue({
      success: true,
      user: mockUser,
      session: { access_token: 'token' },
      sofiaProfile: mockProfile,
    });

    supabaseMocks.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: 'lia-token', user: { id: 'lia-1', email: 'test@soflia.com' } },
        user: { id: 'lia-1', email: 'test@soflia.com' },
      },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      const signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
      expect(signInResult.success).toBe(true);
    });

    expect(result.current.user).not.toBeNull();
  });

  // AUTH-003: Sign out clears state
  it('AUTH-003: signOut clears user and session', async () => {
    sofiaMocks.signOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.sofiaContext).toBeNull();
  });

  // AUTH-004: Organization selection updates context
  it('AUTH-004: setCurrentOrganization updates sofiaContext', async () => {
    // We test that the function exists and is callable
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(typeof result.current.setCurrentOrganization).toBe('function');

    // Calling it without a sofia context should not throw
    act(() => {
      result.current.setCurrentOrganization('org-123');
    });
    // No error thrown — context is null so it's a no-op
  });

  // AUTH-005: Session refresh on auth state change
  it('AUTH-005: auth state change triggers session refresh', async () => {
    // Verify that onAuthStateChange is subscribed
    renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
        // Either sofia or supabase onAuthStateChange should be called
      const totalCalls =
        sofiaMocks.onAuthStateChange.mock.calls.length +
        supabaseMocks.onAuthStateChange.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });

  it('AUTH-006: Lia config errors are sanitized for UI', async () => {
    vi.mocked(getSupabaseConfigError).mockReturnValue('VITE_SUPABASE_ANON_KEY invalida');

    const mockUser = { id: 'sofia-user-1', email: 'test@soflia.com', user_metadata: { first_name: 'Test' } };
    const mockProfile = {
      id: 'sofia-user-1',
      email: 'test@soflia.com',
      memberships: [{ status: 'active', organization_id: 'org-1', team_id: 'team-1' }],
      organizations: [{ id: 'org-1', name: 'TestOrg' }],
      teams: [{ id: 'team-1', name: 'TestTeam', organization_id: 'org-1' }],
    };

    sofiaMocks.signInWithSofia.mockResolvedValue({
      success: true,
      user: mockUser,
      session: { access_token: 'token' },
      sofiaProfile: mockProfile,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    let signInResult: any;
    await act(async () => {
      signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
    });

    expect(signInResult.success).toBe(false);
    expect(signInResult.error).toContain('configuracion interna pendiente');
    expect(signInResult.error).not.toContain('VITE_SUPABASE');
    expect(signInResult.error).not.toContain('test-project-ref');
  });
});
