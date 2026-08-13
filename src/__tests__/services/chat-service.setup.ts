import { beforeEach, vi } from 'vitest';

export const mockSelect = vi.fn();
export const mockInsert = vi.fn();
export const mockEq = vi.fn();
export const mockOrder = vi.fn();
export const mockSingle = vi.fn();
export const mockFrom = vi.fn();
export const mockConversationUpsert = vi.fn();
export const mockMessageUpsert = vi.fn();
export const mockDeleteEq = vi.fn();
export const mockDeleteIn = vi.fn();
export const mockDelete = vi.fn();
/** Filas devueltas por el `delete().select()` de conversaciones. */
export const mockDeleteSelect = vi.fn();
/** Verificacion posterior al borrado: fila visible o no. */
export const mockMaybeSingle = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock('../../lib/supabase-factory', () => ({
  createElectronSupabaseClient: vi.fn(() => null),
  isValidUrl: vi.fn(() => true),
}));

vi.mock('../../config', () => ({
  SUPABASE: { URL: 'https://test.supabase.co', ANON_KEY: 'test-key' },
  GOOGLE_API_KEY: 'test-key',
  MODELS: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockSingle.mockResolvedValue({
    data: {
      id: 'remote-conversation-id',
      user_id: 'user-123',
      title: 'Test Chat',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
    error: null,
  });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle, maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
  mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
  mockConversationUpsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) });
  mockMessageUpsert.mockResolvedValue({ error: null });
  // El borrado de conversaciones se verifica con `select()`: el mock replica el
  // constructor de PostgREST, que es esperable Y encadenable.
  mockDeleteSelect.mockResolvedValue({ data: [{ id: 'conv-borrada' }], error: null });
  mockDeleteEq.mockImplementation(() =>
    Object.assign(Promise.resolve({ data: null, error: null }), { select: mockDeleteSelect }),
  );
  mockDeleteIn.mockResolvedValue({ error: null });
  mockDelete.mockReturnValue({ eq: mockDeleteEq, in: mockDeleteIn });
  mockFrom.mockImplementation((table: string) => table === 'messages'
    ? { select: mockSelect, upsert: mockMessageUpsert, delete: mockDelete }
    : { select: mockSelect, insert: mockInsert, upsert: mockConversationUpsert, delete: mockDelete, update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
});
