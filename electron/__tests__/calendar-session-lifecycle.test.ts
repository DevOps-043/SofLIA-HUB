import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarService } from '../calendar-service';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { restoreGoogleSession } from '../calendar/storage';
import type { CalendarConnection, CalendarEvent } from '../calendar/types';
import { createGmailClient } from '../gmail/client';
import { getDriveClient } from '../drive/google-client';
import { GChatService } from '../gchat-service';
// La carga fría del SDK se completa durante recolección; los casos prueban transporte y sesión.
import { google } from 'googleapis';

vi.mock('googleapis', async () => {
  const { google } = await vi.importActual<typeof import('googleapis')>('googleapis');
  return { google: { auth: google.auth, gmail: vi.fn(() => ({})), drive: vi.fn(() => ({})) } };
});

const entry = (userId: string): CalendarConnection => ({ userId, provider: 'google', email: userId + '@example.test', accessToken: 'ficticio-' + userId, refreshToken: 'renovacion-ficticia', isActive: true });
const event: CalendarEvent = { id: 'evento-ficticio', title: 'Revisión', start: new Date(), end: new Date(Date.now() + 3600000), isAllDay: false, source: 'google' };
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let services: CalendarService[];
beforeEach(() => { resetAuthStateForTests(); services = []; });
afterEach(() => { services.forEach(service => service.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); resetAuthStateForTests(); });
function fixture() {
  const records = new Map<string, CalendarConnection[]>([['A', [entry('A')]], ['B', [entry('B')]]]);
  const credentials = { load: vi.fn(async (owner: string, assert: () => void) => { assert(); return structuredClone(records.get(owner) ?? []); }),
    save: vi.fn(async (owner: string, connections: CalendarConnection[], assert: () => void) => { assert(); records.set(owner, structuredClone(connections)); }) };
  const service = new CalendarService(credentials); services.push(service);
  return { service, credentials, records };
}
const auth = (userId: string | null) => setAuthState({ authenticated: userId !== null, userId });

describe('Ciclo de vida por identidad del calendario y Workspace', () => {
  it('arranca cerrado, restaura por dueño y limpia inmediatamente al cambiar o cerrar sesión', async () => {
    const { service, credentials } = fixture(); await service.init(); await service.init();
    expect(credentials.load).not.toHaveBeenCalled();
    auth('A'); await vi.waitFor(() => expect(service.getConnections()).toMatchObject([{ userId: 'A' }]));
    const revision = service.contextRevision;
    auth('B'); expect(service.getConnections()).toEqual([]);
    await vi.waitFor(() => expect(service.getConnections()).toMatchObject([{ userId: 'B' }]));
    auth('A'); await vi.waitFor(() => expect(service.getConnections()).toMatchObject([{ userId: 'A' }]));
    expect(service.contextRevision).toBeGreaterThan(revision);
    auth(null); expect(service.getConnections()).toEqual([]); expect(await service.getGoogleAuth()).toBeNull();
    expect(service.getPollingStatus()).toEqual({ isPolling: false, inWorkHours: false, currentEvent: null });
    expect(credentials.load.mock.calls.map(call => call[0])).toEqual(['A', 'B', 'A']);
  });
  it('una carga A tardía no publica conexiones en B y permite continuar la cola', async () => {
    const { service, credentials } = fixture(); const waiting = deferred<CalendarConnection[]>();
    credentials.load.mockReturnValueOnce(waiting.promise);
    auth('A'); const initial = service.init(); await vi.waitFor(() => expect(credentials.load).toHaveBeenCalled());
    const connected = vi.fn(); service.on('connected', connected);
    auth('B'); waiting.resolve([entry('A')]); await initial;
    await vi.waitFor(() => expect(service.getConnections()).toMatchObject([{ userId: 'B' }]));
    expect(connected.mock.calls.map(call => call[0].email)).toEqual(['B@example.test']);
  });
  it('revalida antes de cada evento si un listener cambia la sesión durante la restauración', async () => {
    const { service, records } = fixture();
    records.set('A', [entry('A'), { ...entry('A'), provider: 'microsoft', email: 'privado-A@example.test' }]);
    const published: string[] = [];
    service.on('connected', data => { published.push(data.email); if (data.email === 'A@example.test') auth('B'); });
    auth('A'); await service.init();
    await vi.waitFor(() => expect(service.getConnections()).toMatchObject([{ userId: 'B' }]));
    expect(published).toEqual(['A@example.test', 'B@example.test']);
  });
  it('no publica una conexión hasta persistirla y conserva la anterior si falla', async () => {
    const { service, credentials } = fixture(); service.setUserId('A'); await service.loadConnections();
    credentials.save.mockRejectedValueOnce(new Error('Disco ficticio'));
    await expect(service.setConnection({ ...entry('A'), email: 'nueva@example.test' }, () => {})).rejects.toThrow();
    expect(service.getConnections()).toMatchObject([{ email: 'A@example.test' }]);
    await service.disconnect('google'); expect(service.getConnections()).toEqual([]);
    await service.loadConnections(); expect(service.getConnections()).toEqual([]);
  });
  it('serializa conexiones de ambos proveedores para no perder una escritura concurrente', async () => {
    const { service, records } = fixture(); service.setUserId('A');
    await Promise.all([service.setConnection(entry('A'), () => {}), service.setConnection({ ...entry('A'), provider: 'microsoft' }, () => {})]);
    expect(records.get('A')?.map(value => value.provider)).toEqual(['google', 'microsoft']);
  });
  it('rechaza la escritura encolada de A incluso después de volver a A', async () => {
    const { service, credentials } = fixture(); service.setUserId('A');
    const pending = service.setConnection(entry('A'), () => {});
    service.setUserId('B'); service.setUserId('A');
    await expect(pending).rejects.toThrow('sesión'); expect(credentials.save).not.toHaveBeenCalled();
  });
  it('los clientes retenidos deniegan solicitudes y respuestas después de cambiar identidad', async () => {
    const { service } = fixture(); service.setUserId('A'); await service.loadConnections();
    const client = (await service.getGoogleAuth())!;
    const transport = vi.fn<typeof fetch>(async () => Response.json({ correcto: true }));
    expect((await client.transporter.request({ url: 'https://example.invalid', fetchImplementation: transport })).data).toEqual({ correcto: true });
    const waiting = deferred<void>();
    transport.mockImplementationOnce(async () => { await waiting.promise; return Response.json({ correcto: true }); });
    const response = client.transporter.request({ url: 'https://example.invalid', fetchImplementation: transport });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    service.setUserId('B'); service.setUserId('A'); waiting.resolve();
    await expect(response).rejects.toThrow('sesión');
    await expect(client.transporter.request({ url: 'https://example.invalid', fetchImplementation: transport })).rejects.toThrow('sesión');
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('renovaciones tardías no alteran tokens ni persisten o emiten en el contexto nuevo', async () => {
    const { service, credentials } = fixture(); service.setUserId('A'); await service.loadConnections();
    const client = (await service.getGoogleAuth())!; const old = service.connections.get('google')!;
    const renewed = vi.fn(); service.on('token-refreshed', renewed);
    service.setUserId('B'); service.setUserId('A');
    client.emit('tokens', { access_token: 'tardio-ficticio', refresh_token: 'tardio-ficticio' });
    await Promise.resolve(); expect(old.accessToken).toBe('ficticio-A');
    expect(credentials.save).not.toHaveBeenCalled(); expect(renewed).not.toHaveBeenCalled();
  });
  it('persiste tokens rotados sólo para la conexión vigente', async () => {
    const { service, records } = fixture(); service.setUserId('A'); await service.loadConnections();
    const client = (await service.getGoogleAuth())!;
    client.emit('tokens', { access_token: 'nuevo-ficticio', refresh_token: 'rotado-ficticio' });
    await vi.waitFor(() => expect(records.get('A')?.[0]).toMatchObject({ accessToken: 'nuevo-ficticio', refreshToken: 'rotado-ficticio' }));
  });
  it('Gmail, Drive y Chat conservan el resultado no conectado tras logout', async () => {
    const { service } = fixture(); service.setUserId('A'); await service.loadConnections();
    expect((await createGmailClient(service)).client).toBeDefined(); expect(await getDriveClient(service)).not.toBeNull();
    service.setUserId(null);
    expect(await createGmailClient(service)).toEqual({ error: 'Google no conectado' });
    expect(await getDriveClient(service)).toBeNull();
    expect(await new GChatService(service).listSpaces()).toEqual({ success: false, error: 'Google no conectado' });
  });
  it('no emite polling pendiente después de detenerlo y no solapa consultas', async () => {
    vi.useFakeTimers(); const { service } = fixture(); service.setUserId('A');
    const waiting = deferred<CalendarEvent[]>(); const get = vi.spyOn(service, 'getCurrentEvents').mockReturnValue(waiting.promise);
    const polled = vi.fn(); service.on('poll', polled); service.startPolling(1000);
    await vi.advanceTimersByTimeAsync(4000); expect(get).toHaveBeenCalledTimes(1);
    service.stopPolling(); waiting.resolve([event]); await Promise.resolve(); await Promise.resolve();
    expect(polled).not.toHaveBeenCalled(); expect(service.getPollingStatus().currentEvent).toBeNull();
  });
  it('dispose retira listeners y evita nuevas restauraciones', async () => {
    const { service, credentials } = fixture(); await service.init(); service.dispose(); service.dispose();
    auth('A'); await Promise.resolve(); expect(credentials.load).not.toHaveBeenCalled();
  });
  it('una restauración remota tardía no modifica la conexión anterior ni el archivo', async () => {
    const { service, credentials } = fixture(); service.setUserId('A'); await service.loadConnections();
    service.setConfig({ google: { clientId: 'ficticio', clientSecret: 'ficticio' } });
    const waiting = deferred<{ credentials: { access_token: string }; res: null }>();
    vi.spyOn(google.auth.OAuth2.prototype, 'refreshAccessToken').mockImplementation(() => waiting.promise);
    const old = service.connections.get('google')!; const restored = vi.fn(); service.on('session-restored', restored);
    const pending = restoreGoogleSession(service);
    await vi.waitFor(() => expect(google.auth.OAuth2.prototype.refreshAccessToken).toHaveBeenCalled());
    service.setUserId('B'); service.setUserId('A'); waiting.resolve({ credentials: { access_token: 'tardio-ficticio' }, res: null });
    await pending; expect(old.accessToken).toBe('ficticio-A'); expect(credentials.save).not.toHaveBeenCalled(); expect(restored).not.toHaveBeenCalled();
  });
});
