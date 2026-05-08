import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createCalendarService } from './setup';
import { mockExistsSync, mockReadFileSync, resetCalendarMocks } from './mocks';
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

  it('CAL-004: loadConnections emits connected for each saved connection', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([{
      provider: 'google',
      email: 'saved@test.com',
      userId: 'u1',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]));

    const events: any[] = [];
    service.on('connected', (data: any) => events.push(data));
    service.loadConnections();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ provider: 'google', email: 'saved@test.com' });
  });

  it('CAL-005: loadConnections handles missing file gracefully', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => service.loadConnections()).not.toThrow();
  });
});
