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

describe('AuthContext Lia degraded mode', () => {
  beforeEach(resetAuthMocks);

  it('AUTH-006: Lia sync failures mark the session as degraded without blocking SOFIA access', async () => {
    sofiaMocks.signInWithSofia.mockResolvedValue(createSofiaSignInPayload());
    supabaseMocks.getSession.mockRejectedValueOnce(new Error('Invalid API key'));
    supabaseMocks.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error('Invalid login credentials'),
    } as any);
    supabaseMocks.signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: new Error('User already registered'),
    } as any);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    let signInResult: any;
    await act(async () => {
      signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
    });

    expect(signInResult.success).toBe(true);
    expect(signInResult.error).toBeUndefined();
    expect(result.current.user?.id).toBe('sofia-user-1');
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(true);
    expect(result.current.liaStatusMessage).toContain('configuracion vieja o incompleta');
  });
});
