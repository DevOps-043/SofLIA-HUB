import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fixture from './whatsapp-service.fixtures';
import { registerConnectionEvents } from '../whatsapp/connection-events';
import { cancelWhatsAppReconnect, scheduleWhatsAppReconnect } from '../whatsapp/reconnect';
import { setAuthState } from '../main/auth-state';
import type { WhatsAppServiceCore } from '../whatsapp/types';
import { DEFAULT_CONFIG } from '../whatsapp/types';
import { registerCallEvents } from '../whatsapp/call-events';

const tracked: WhatsAppServiceCore[] = [];
afterEach(() => { tracked.splice(0).forEach(cancelWhatsAppReconnect); vi.useRealTimers(); vi.restoreAllMocks(); });
function create() {
  const events = new EventEmitter();
  const service = Object.assign(new EventEmitter(), { sock: { ev: events, end: vi.fn() }, connected: false,
    config: { ...DEFAULT_CONFIG }, reconnectAttempts: 0, maxReconnectAttempts: 5,
    connect: vi.fn().mockResolvedValue(undefined), getStatus: vi.fn(() => ({})) }) as unknown as WhatsAppServiceCore & EventEmitter;
  tracked.push(service);
  return { service, events };
}
describe('Reintentos y eventos WhatsApp sin recursos huérfanos', () => {
  it('un fallo en una llamada no rechaza el listener ni bloquea la siguiente', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, events } = create();
    const publish = vi.spyOn(service, 'emit');
    Object.assign(service.sock!, { rejectCall: vi.fn().mockResolvedValue(undefined) });
    service.recordHistory = vi.fn().mockImplementationOnce(() => { throw new Error('Historial no disponible'); });
    registerCallEvents(service);
    const offer = { id: 'llamada-ficticia', from: '123@s.whatsapp.net', status: 'offer' };
    events.emit('call', [offer, offer]);
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith('call-offer', expect.any(Object)));
    expect(error).toHaveBeenCalled();
  });

  it('cancelar entre el vencimiento del timer y su microtarea impide reconectar', async () => {
    vi.useFakeTimers();
    const { service } = create(); service.sock = null;
    scheduleWhatsAppReconnect(service, 10);
    vi.advanceTimersByTime(10);
    cancelWhatsAppReconnect(service);
    await Promise.resolve();
    expect(service.connect).not.toHaveBeenCalled();
  });

  it('conserva un solo reintento y lo cancela al cerrar sesión', async () => {
    vi.useFakeTimers();
    const { service } = create(); service.sock = null;
    scheduleWhatsAppReconnect(service, 2000); scheduleWhatsAppReconnect(service, 2000);
    expect(vi.getTimerCount()).toBe(1);
    setAuthState({ authenticated: false, userId: null });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30000);
    expect(service.connect).not.toHaveBeenCalled();
  });

  it('contiene un rechazo de conexión programada', async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service } = create(); service.sock = null;
    vi.mocked(service.connect).mockRejectedValue(new Error('Sin red'));
    scheduleWhatsAppReconnect(service, 10);
    await vi.advanceTimersByTimeAsync(10);
    expect(service.connect).toHaveBeenCalledOnce(); expect(error).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignora cierre tardío de un socket retirado incluso si no existe reemplazo', () => {
    vi.useFakeTimers();
    const { service, events } = create();
    registerConnectionEvents(service, vi.fn(), 401); service.sock = null;
    events.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 428 } } } });
    expect(service.reconnectAttempts).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });

  it('contiene fallos asíncronos de credenciales y persistencia de conexión', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service, events } = create();
    registerConnectionEvents(service, vi.fn().mockRejectedValue(new Error('Disco lleno')), 401);
    events.emit('creds.update');
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    fixture.mockFsWriteFile.mockRejectedValueOnce(new Error('Disco lleno'));
    events.emit('connection.update', { connection: 'open' });
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    const disconnected = vi.fn(); service.on('disconnected', disconnected);
    fixture.mockFsRm.mockRejectedValueOnce(new Error('Sin permiso'));
    events.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(3));
    expect(disconnected).toHaveBeenCalledWith(401);
    expect(service.config.autoConnect).toBe(false);
  });
});
