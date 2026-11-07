import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMicrosoftEvents } from '../calendar/event-fetchers';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@microsoft/microsoft-graph-client', () => ({ Client: { init: () => ({ api: () => {
  const query = { query: () => query, select: () => query, orderby: () => query, top: () => query, get: api.get }; return query;
} }) } }));
const connection = { userId: 'A', provider: 'microsoft' as const, accessToken: 'ficticio', refreshToken: '', isActive: true };
const item = (dateTime: string) => ({ id: 'ficticio', subject: 'Revisión', start: { dateTime }, end: { dateTime }, privado: 'no-exponer' });
beforeEach(() => vi.clearAllMocks());
describe('Contrato de eventos Microsoft', () => {
  it.each(['2026-10-22T10:00:00', '2026-10-22T10:00:00Z', '2026-10-22T04:00:00-06:00'])('normaliza fecha UTC sin duplicar offset: %s', async dateTime => {
    api.get.mockResolvedValue({ value: [item(dateTime)] });
    const events = await fetchMicrosoftEvents(connection, new Date(), new Date());
    expect(events[0].start.toISOString()).toBe('2026-10-22T10:00:00.000Z');
    expect(events[0]).not.toHaveProperty('privado');
  });
  it('rechaza respuesta inválida y comprueba contexto antes de consultar', async () => {
    api.get.mockResolvedValue({ value: [item('fecha-invalida')] });
    await expect(fetchMicrosoftEvents(connection, new Date(), new Date())).rejects.toThrow();
    api.get.mockClear();
    await expect(fetchMicrosoftEvents(connection, new Date(), new Date(), () => { throw new Error('Revocado'); })).rejects.toThrow('Revocado');
    expect(api.get).not.toHaveBeenCalled();
  });
});
