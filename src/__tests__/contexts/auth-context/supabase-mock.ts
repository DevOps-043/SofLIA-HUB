import { vi } from 'vitest';
import { createSupabaseDiagnostics } from './diagnostics';

export const supabaseMocks = {
  signOut: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
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
      onAuthStateChange: supabaseMocks.onAuthStateChange,
    },
  },
  getSupabaseConfigDiagnostics: supabaseMocks.getSupabaseConfigDiagnostics,
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.doMock('../../../lib/sofia-client', () => ({
  sofiaSupa: null,
  isSofiaConfigured: vi.fn(() => true),
}));

vi.doMock('../../../config', () => ({
  SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' },
  SOFIA_SUPABASE: { URL: 'https://test-sofia.supabase.co', ANON_KEY: 'test-key' },
}));

export function resetSupabaseMocks(): void {
  supabaseMocks.signOut.mockResolvedValue({ error: null });
  supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseMocks.signInWithPassword.mockResolvedValue({
    data: { session: { user: { id: 'lia-user-1', email: 'test@soflia.com' } } },
    error: null,
  });
  supabaseMocks.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
  supabaseMocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  supabaseMocks.getSupabaseConfigDiagnostics.mockReturnValue(createSupabaseDiagnostics());
}
