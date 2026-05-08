import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCalendarService } from './setup';
import { mockExistsSync, mockReadFileSync, resetCalendarMocks } from './mocks';
import type { CalendarService } from '../../calendar-service';

describe('CalendarService disconnect and polling status', () => {
  let service: CalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCalendarMocks();
    service = createCalendarService();
  });

  it('CAL-009: disconnect removes connection and emits disconnected', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify([{
      provider: 'google',
      email: 'x@test.com',
      userId: 'u1',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]));
    service.loadConnections();

    const disconnected: any[] = [];
    service.on('disconnected', (data: any) => disconnected.push(data));
    await service.disconnect('google');

    expect(disconnected).toHaveLength(1);
    expect(disconnected[0].provider).toBe('google');
    expect(service.getConnections()).toHaveLength(0);
  });

  it('CAL-010: getPollingStatus returns not polling by default', () => {
    const status = service.getPollingStatus();
    expect(status.isPolling).toBe(false);
    expect(status.inWorkHours).toBe(false);
    expect(status.currentEvent).toBeNull();
  });
});
