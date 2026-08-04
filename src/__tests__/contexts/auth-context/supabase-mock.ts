import { vi } from 'vitest';
import { createSupabaseDiagnostics } from './diagnostics';

export const supabaseMocks = {
  signOut: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
  invoke: vi.fn(),
  getSofiaSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSupabaseConfigDiagnostics: vi.fn(),
};

vi.doMock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: supabaseMocks.signOut,
      getSession: supabaseMocks.getSession,
      refreshSession: supabaseMocks.refreshSession,
      signInWithPassword: supabaseMocks.signInWithPassword,
      signUp: supabaseMocks.signUp,
      updateUser: supabaseMocks.updateUser,
      verifyOtp: supabaseMocks.verifyOtp,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
    },
    functions: {
      invoke: supabaseMocks.invoke,
    },
  },
  getSupabaseConfigDiagnostics: supabaseMocks.getSupabaseConfigDiagnostics,
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.doMock('../../../lib/sofia-client', () => ({
  sofiaSupa: { auth: { getSession: supabaseMocks.getSofiaSession } },
  isSofiaConfigured: vi.fn(() => true),
}));

vi.doMock('../../../config', () => ({
  SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' },
  SOFIA_SUPABASE: { URL: 'https://test-sofia.supabase.co', ANON_KEY: 'test-key' },
}));

export function resetSupabaseMocks(): void {
  // mockReset y no solo clearAllMocks: este ultimo borra el historial de
  // llamadas pero NO la cola de mockResolvedValueOnce. Un caso que encolaba una
  // respuesta y no llegaba a consumirla se la dejaba servida al siguiente test.
  for (const mock of Object.values(supabaseMocks)) mock.mockReset();

  supabaseMocks.signOut.mockResolvedValue({ error: null });
  supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseMocks.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: 'lia-user-1', email: 'test@soflia.com' } } },
    error: null,
  });
  supabaseMocks.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
  supabaseMocks.updateUser.mockResolvedValue({ data: { user: { id: 'lia-user-1' } }, error: null });
  supabaseMocks.verifyOtp.mockResolvedValue({
    data: { session: { user: { id: 'lia-user-1', email: 'test@soflia.com' } }, user: null },
    error: null,
  });
  supabaseMocks.invoke.mockResolvedValue({ data: { tokenHash: 'token-un-solo-uso' }, error: null });
  supabaseMocks.getSofiaSession.mockResolvedValue({ data: { session: { access_token: 'token-restaurado' } }, error: null });
  supabaseMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  supabaseMocks.getSupabaseConfigDiagnostics.mockReturnValue(createSupabaseDiagnostics());
}
