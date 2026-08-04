import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSofiaSignInPayload,
  createWrapper,
  resetAuthMocks,
  sofiaMocks,
  supabaseMocks,
  useAuth,
} from './setup';

describe('AuthContext session actions', () => {
  beforeEach(resetAuthMocks);

  it('AUTH-002: signInWithSofia sets user and Lia session on success', async () => {
    localStorage.removeItem('lia-sync-cred');
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      const signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
      expect(signInResult.success).toBe(true);
    });

    expect(result.current.user).not.toBeNull();
    expect(supabaseMocks.invoke).toHaveBeenCalledWith('sofia-session-exchange', {
      body: {},
      headers: { Authorization: 'Bearer token' },
    });
    expect(supabaseMocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'token-un-solo-uso',
      type: 'magiclink',
    });
    expect(supabaseMocks.signInWithPassword).not.toHaveBeenCalled();
    expect(supabaseMocks.signUp).not.toHaveBeenCalled();
    expect(result.current.session?.user.id).toBe('lia-user-1');
    expect(result.current.dataUserId).toBe('lia-user-1');
    expect(localStorage.getItem('lia-sync-cred')).toBeNull();
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

  it('AUTH-004: setCurrentOrganization is callable without SOFIA context', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(typeof result.current.setCurrentOrganization).toBe('function');
    act(() => {
      result.current.setCurrentOrganization('org-123');
    });
  });
});
