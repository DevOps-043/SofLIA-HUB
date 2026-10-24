import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createCalendarService } from './setup';
import { mockLoadConnections, resetCalendarMocks } from './mocks';
import type { CalendarService } from '../../calendar-service';

describe('CalendarService config and connections', () => {
  let service: CalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCalendarMocks();
    service = createCalendarService();
  });

  it('CAL-001: is an EventEmitter instance', () => {
    expect(service).toBeInstanceOf(EventEmitter);
  });

  it('CAL-002: setConfig stores Google OAuth config', () => {
    expect(() => service.setConfig({ google: { clientId: 'cid', clientSecret: 'csecret' } })).not.toThrow();
  });

  it('CAL-003: connectGoogle errors when OAuth credentials are not configured', async () => {
    service.setConfig({});
    const result = await service.connectGoogle();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Google OAuth credentials not configured');
  });

  it('CAL-004: restaura conexiones del propietario y emite connected', async () => {
    mockLoadConnections.mockResolvedValue([{
      provider: 'google',
      email: 'saved@test.com',
      userId: 'user-123',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]);

    const events: { provider: string; email: string }[] = [];
    service.on('connected', data => events.push(data));
    await service.loadConnections();
    expect(mockLoadConnections).toHaveBeenCalledWith('user-123', expect.any(Function));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: 'google', email: 'saved@test.com' });
  });

  it('CAL-005: admite un almacén vacío y propaga fallo sin publicar conexiones parciales', async () => {
    await expect(service.loadConnections()).resolves.toBeUndefined();
    mockLoadConnections.mockRejectedValueOnce(new Error('Fallo simulado'));
    await expect(service.loadConnections()).rejects.toThrow('Fallo simulado');
    expect(service.getConnections()).toEqual([]);
  });
});
