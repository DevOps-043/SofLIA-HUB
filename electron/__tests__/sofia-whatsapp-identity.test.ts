import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), setSession: vi.fn(), from: vi.fn(), query: vi.fn() }));
vi.mock('../sofia/clients', () => ({ getSofiaClient: () => ({ from: mocks.from }) }));
vi.mock('../sofia/sessions', () => ({ getSession: mocks.getSession, setSession: mocks.setSession }));
import { tryAutoAuthByPhone } from '../sofia/phone-auto-auth';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockReturnValue(null);
  mocks.from.mockReturnValue({ select: () => ({ not: mocks.query }) });
});
describe('identidad SOFIA independiente de IRIS', () => {
  it('identifica un teléfono existente sin sincronizar cuentas o equipos externos', async () => {
    mocks.query.mockResolvedValue({ data: [{ id: 'sofia-1', email: 'ana@example.com', display_name: 'Ana', phone: '+52 5551234567' }], error: null });
    const result = await tryAutoAuthByPhone('525551234567');
    expect(result).toMatchObject({ success: true, session: { userId: 'sofia-1', fullName: 'Ana' } });
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('users');
    expect(mocks.setSession).toHaveBeenCalledWith(result.session);
  });
  it.each(['', '123', '5551234567'])('rechaza teléfono vacío, incompleto o ambiguo: %s', async phone => {
    mocks.query.mockResolvedValue({ data: [{ id: 'uno', phone: '5551234567' }, { id: 'dos', phone: '5551234567' }], error: null });
    expect((await tryAutoAuthByPhone(phone)).success).toBe(false);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });
  it('conserva sesiones existentes sin consultar ninguna base remota', async () => {
    mocks.getSession.mockReturnValue({ userId: 'existente', fullName: 'Ana' });
    expect((await tryAutoAuthByPhone('5551234567')).success).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
