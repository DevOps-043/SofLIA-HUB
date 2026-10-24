import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGoogleEvents } from '../calendar/event-fetchers';
import { connectGoogle } from '../calendar/google-oauth';
import { createEvent } from '../calendar/event-writes';
import { updateEvent, deleteEvent } from '../calendar/event-updates';
import type { CalendarServiceCore } from '../calendar/types';
import { exposeCalendarApi } from '../preload/calendar-api';
import { createSafeIpc } from '../preload/safe-ipc';
import type { CalendarBridge } from '../../src/shared/calendar';
import { CalendarService } from '../calendar-service';
import { openOAuthWindow } from '../calendar/oauth-window';

const calls = vi.hoisted(() => ({ insert: vi.fn(), patch: vi.fn(), remove: vi.fn(), getToken: vi.fn() }));
vi.mock('../calendar/oauth-window', () => ({ openOAuthWindow: vi.fn(async () => 'codigo-ficticio') }));
vi.mock('googleapis', () => ({ google: {
  calendar: () => ({ events: { insert: calls.insert, patch: calls.patch, delete: calls.remove } }),
  auth: { OAuth2: vi.fn(function () { return { generateAuthUrl: () => 'https://example.test', getToken: calls.getToken, setCredentials: vi.fn() }; }) },
  oauth2: () => ({ userinfo: { get: async () => ({ data: { email: 'cuenta@example.test' } }) } }),
} }));
beforeEach(() => { vi.clearAllMocks(); calls.insert.mockResolvedValue({ data: { id: 'nuevo' } }); calls.patch.mockResolvedValue({}); calls.remove.mockResolvedValue({}); calls.getToken.mockResolvedValue({ tokens: { access_token: 'ficticio' } }); vi.mocked(openOAuthWindow).mockResolvedValue('codigo-ficticio'); });
const input = { title: 'Revisión', start: new Date('2026-10-22T16:00:00Z'), end: new Date('2026-10-22T17:00:00Z') };

describe('Mutaciones del servicio calendario', () => {
  it('OAuth no intercambia el código después de una transición A/B/A', async () => {
    const credentials = { load: vi.fn(async () => []), save: vi.fn(async () => {}) };
    const service = new CalendarService(credentials); service.setUserId('A');
    service.setConfig({ google: { clientId: 'ficticio', clientSecret: 'ficticio' } });
    vi.mocked(openOAuthWindow).mockImplementationOnce(async () => { service.setUserId('B'); service.setUserId('A'); return 'codigo-ficticio'; });
    expect(await service.connectGoogle()).toMatchObject({ success: false });
    expect(calls.getToken).not.toHaveBeenCalled(); expect(credentials.save).not.toHaveBeenCalled(); service.dispose();
  });
  it('no consulta Google sin una credencial vigente', async () => {
    const service = { getGoogleAuth: async () => null } as unknown as CalendarServiceCore;
    const conn = { provider: 'google' as const, userId: 'usuario', accessToken: '', refreshToken: '', isActive: true };
    await expect(fetchGoogleEvents(service, conn, input.start, input.end)).rejects.toThrow('Google no conectado');
  });
  it('no persiste una conexión OAuth si su sesión dejó de ser vigente', async () => {
    const service = { config: { google: { clientId: 'ficticio', clientSecret: 'ficticio' } }, connections: new Map(), saveConnections: vi.fn(async () => {}), emit: vi.fn(), userId: 'actual', contextRevision: 0,
      setConnection: async (connection: { provider: string; userId: string }, assert: () => void) => { assert(); service.connections.set(connection.provider, connection); await service.saveConnections(); } };
    const guard = () => { throw new Error('Sesión cambiada'); };
    expect(await connectGoogle(service as unknown as CalendarServiceCore, guard, 'actual')).toMatchObject({ success: false });
    expect(service.connections.size).toBe(0); expect(service.saveConnections).not.toHaveBeenCalled();
    expect(await connectGoogle(service as unknown as CalendarServiceCore, () => {}, 'actual')).toMatchObject({ success: true });
    expect(service.connections.get('google')).toMatchObject({ userId: 'actual' });
  });
  it.each(['crear', 'editar', 'eliminar'])('revalida después de obtener OAuth y antes de enviar: %s', async mode => {
    let current = true;
    const service = { getGoogleAuth: async () => { current = false; return {}; } } as unknown as CalendarServiceCore;
    const guard = () => { if (!current) throw new Error('Sesión cambiada'); };
    const result = mode === 'crear' ? await createEvent(service, input, guard) : mode === 'editar'
      ? await updateEvent(service, 'evento', { title: 'Cambio' }, guard) : await deleteEvent(service, 'evento', 'primary', guard);
    expect(result.success).toBe(false);
    expect(calls.insert).not.toHaveBeenCalled(); expect(calls.patch).not.toHaveBeenCalled(); expect(calls.remove).not.toHaveBeenCalled();
  });
  it('preserva el contrato interno y fechas al crear sin cambiar los consumidores main', async () => {
    const service = { getGoogleAuth: async () => ({}) } as unknown as CalendarServiceCore;
    expect(await createEvent(service, input)).toMatchObject({ success: true, eventId: 'nuevo' });
    expect(calls.insert).toHaveBeenCalledWith(expect.objectContaining({ requestBody: expect.objectContaining({ summary: 'Revisión', start: { dateTime: '2026-10-22T16:00:00.000Z' } }) }));
  });
  it('no devuelve errores del proveedor', async () => {
    calls.remove.mockRejectedValueOnce(new Error('token-privado /ruta/local'));
    const service = { getGoogleAuth: async () => ({}) } as unknown as CalendarServiceCore;
    const result = await deleteEvent(service, 'evento'); expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/privado|ruta/);
  });
});

describe('Preload de calendario', () => {
  it('transporta el DTO ISO por canales allowlisted y devuelve cancelación sin ampliarla', async () => {
    const invoke = vi.fn(async () => ({ success: false, cancelled: true }));
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const ipc = createSafeIpc({ invoke, send: vi.fn(), on: (channel, callback) => listeners.set(channel, callback), off: channel => listeners.delete(channel), removeAllListeners: channel => { listeners.delete(channel); } });
    let exposed: unknown;
    exposeCalendarApi({ exposeInMainWorld: (_name, api) => { exposed = api; } }, ipc);
    const api = exposed as CalendarBridge;
    const dto = { title: input.title, start: input.start.toISOString(), end: input.end.toISOString() };
    expect(await api.createEvent(dto)).toEqual({ success: false, cancelled: true });
    expect(invoke).toHaveBeenCalledWith('calendar:create-event', dto);
    expect(() => ipc.validateChannel('calendar:execute')).toThrow();
    const listener = vi.fn(); const unsubscribe = api.onPoll(listener);
    listeners.get('calendar:poll')?.({}, { events: [{ start: dto.start, end: dto.end }], inWorkHours: false, currentEvent: null, nextEvent: null });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ events: [{ start: dto.start, end: dto.end }] }));
    unsubscribe(); expect(listeners.has('calendar:poll')).toBe(false);
  });
});
