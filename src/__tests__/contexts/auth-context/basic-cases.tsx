import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createWrapper, sofiaMocks, supabaseMocks, useAuth } from './setup';
import { sofiaProfile, sofiaUser } from './fixtures';

export function registerAuthContextBasicTests() {
  it('AUTH-001: AuthProvider initializes with loading=true', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(false);
  });

  it('AUTH-002: signInWithSofia sets user on success', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue({
      success: true,
      user: sofiaUser(),
      session: { access_token: 'token' },
      sofiaProfile: sofiaProfile(),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {
      const signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
      expect(signInResult.success).toBe(true);
    });

    expect(result.current.user).not.toBeNull();
    expect(supabaseMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@soflia.com',
      password: 'password123',
    });
    expect(result.current.session?.user.id).toBe('lia-user-1');
    expect(result.current.dataUserId).toBe('lia-user-1');
  });

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

  it('AUTH-004: setCurrentOrganization is callable without active SOFIA context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(typeof result.current.setCurrentOrganization).toBe('function');
    act(() => {
      result.current.setCurrentOrganization('org-123');
    });
  });

  it('AUTH-005: auth state change triggers session refresh subscription', async () => {
    renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      const totalCalls =
        sofiaMocks.onAuthStateChange.mock.calls.length +
        supabaseMocks.onAuthStateChange.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });
}
