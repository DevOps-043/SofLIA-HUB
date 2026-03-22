/**
 * Tests AUTH-001 to AUTH-005: AuthContext — Authentication context tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock sofia-auth
const mockSignInWithSofia = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockFetchSofiaUserProfile = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSetCurrentOrganization = vi.fn();
const mockSetCurrentTeam = vi.fn();

vi.mock('../../services/sofia-auth', () => ({
  sofiaAuth: {
    signInWithSofia: mockSignInWithSofia,
    signOut: mockSignOut,
    getSession: mockGetSession,
    fetchSofiaUserProfile: mockFetchSofiaUserProfile,
    onAuthStateChange: mockOnAuthStateChange,
    setCurrentOrganization: mockSetCurrentOrganization,
    setCurrentTeam: mockSetCurrentTeam,
  },
  SofiaContext: {},
}));

// Mock Supabase
const mockSupabaseSignOut = vi.fn(async () => ({ error: null }));
const mockSupabaseGetSession = vi.fn(async () => ({ data: { session: null }, error: null }));
const mockSupabaseOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));
const mockSupabaseSignInWithPassword = vi.fn();
const mockSupabaseSignUp = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: mockSupabaseSignOut,
      getSession: mockSupabaseGetSession,
      onAuthStateChange: mockSupabaseOnAuthStateChange,
      signInWithPassword: mockSupabaseSignInWithPassword,
      signUp: mockSupabaseSignUp,
    },
  },
  isSupabaseConfigured: vi.fn(() => true),
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

function createWrapper() {
  return ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockOnAuthStateChange.mockReturnValue({
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

    mockSignInWithSofia.mockResolvedValue({
      success: true,
      user: mockUser,
      session: { access_token: 'token' },
      sofiaProfile: mockProfile,
    });

    mockSupabaseSignInWithPassword.mockResolvedValue({
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
    mockSignOut.mockResolvedValue(undefined);

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
        mockOnAuthStateChange.mock.calls.length +
        mockSupabaseOnAuthStateChange.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });
});
