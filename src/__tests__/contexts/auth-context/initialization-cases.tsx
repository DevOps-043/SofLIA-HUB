import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper, resetAuthMocks, sofiaMocks, supabaseMocks, useAuth } from './setup';

describe('AuthContext initialization', () => {
  beforeEach(resetAuthMocks);

  it('AUTH-001: AuthProvider initializes with loading=true', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
    expect(result.current.dataUserId).toBeNull();
    expect(result.current.liaDegraded).toBe(false);
  });

  it('AUTH-005: auth state change subscribes to session refresh sources', async () => {
    renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      const totalCalls =
        sofiaMocks.onAuthStateChange.mock.calls.length +
        supabaseMocks.onAuthStateChange.mock.calls.length;
      expect(totalCalls).toBeGreaterThan(0);
    });
  });
});
