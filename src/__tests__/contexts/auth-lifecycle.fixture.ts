import { vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import type { SofiaContextResolution } from '../../contexts/auth/types';
import { createAuthOperations } from '../../contexts/auth/auth-operations';

export const authMocks = {
  sofiaRead: vi.fn(), sofiaSubscribe: vi.fn(), liaRead: vi.fn(), liaSubscribe: vi.fn(),
  refresh: vi.fn(), signOut: vi.fn(), invoke: vi.fn(), verifyOtp: vi.fn(), profile: vi.fn(),
};

export function session(id = 'a'): Session {
  return { access_token: `token-ficticio-${id}`, refresh_token: `refresh-ficticio-${id}`,
    token_type: 'bearer', expires_in: 3600,
    user: { id, email: `${id}@example.invalid`, aud: 'authenticated', created_at: '',
      app_metadata: {}, user_metadata: {} } };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function resetFixture() {
  Object.values(authMocks).forEach(mock => mock.mockReset());
  authMocks.sofiaRead.mockResolvedValue(null);
  authMocks.liaRead.mockResolvedValue({ data: { session: null } });
  authMocks.refresh.mockResolvedValue({ data: { session: null } });
  authMocks.signOut.mockResolvedValue({ error: null });
  authMocks.invoke.mockResolvedValue({ data: { tokenHash: 'hash-ficticio' }, error: null });
  authMocks.verifyOtp.mockResolvedValue({ data: { session: session() }, error: null });
  authMocks.profile.mockResolvedValue(undefined);
  const subscription = { unsubscribe: vi.fn() };
  authMocks.sofiaSubscribe.mockReturnValue({ data: { subscription } });
  authMocks.liaSubscribe.mockReturnValue({ data: { subscription } });
  return {
    operations: createAuthOperations(),
    usingSofia: true, subscription,
    clearSessionState: vi.fn(), setLoading: vi.fn(), setUser: vi.fn(), setSession: vi.fn(),
    setSofiaSession: vi.fn(),
    setSofiaContext: vi.fn(), setSofiaContextIssue: vi.fn(), setLiaDegraded: vi.fn(),
    setLiaStatusMessage: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined),
    resolveSofiaContext: vi.fn<(id: string) => Promise<SofiaContextResolution>>()
      .mockResolvedValue({ status: 'error', error: new Error('caida-ficticia') }),
    ensureLiaSession: vi.fn().mockResolvedValue(session()),
  };
}

export function emit(event: string, value: Session | null, usingSofia = true): unknown {
  const subscribe = usingSofia ? authMocks.sofiaSubscribe : authMocks.liaSubscribe;
  const callback = subscribe.mock.lastCall?.[0] as (event: string, value: Session | null) => unknown;
  return callback(event, value);
}
