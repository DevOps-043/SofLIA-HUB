import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SofiaAuthResult } from '../../../services/sofia-auth';
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
    supabaseMocks.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 403 } } });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    let signInResult: SofiaAuthResult | undefined;
    await act(async () => {
      signInResult = await result.current.signInWithSofia('test@soflia.com', 'password123');
    });

    expect(signInResult?.success).toBe(true);
    expect(signInResult?.error).toBeUndefined();
    expect(result.current.user?.id).toBe('sofia-user-1');
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(true);
    expect(result.current.liaStatusMessage).toBe('No pudimos cargar tus conversaciones. Intenta nuevamente.');
    expect(supabaseMocks.signInWithPassword).not.toHaveBeenCalled();
  });
});
