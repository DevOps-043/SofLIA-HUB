import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCalendarService } from './setup';
import { mockLoadConnections, mockSaveConnections, resetCalendarMocks } from './mocks';
import type { CalendarService } from '../../calendar-service';

describe('CalendarService disconnect and polling status', () => {
  let service: CalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCalendarMocks();
    service = createCalendarService();
  });

  it('CAL-009: disconnect removes connection and emits disconnected', async () => {
    mockLoadConnections.mockResolvedValue([{
      provider: 'google',
      email: 'x@test.com',
      userId: 'user-123',
      accessToken: 'at',
      refreshToken: 'rt',
      isActive: true,
    }]);
    await service.loadConnections();

    const disconnected: { provider: string }[] = [];
    service.on('disconnected', data => disconnected.push(data));
    await service.disconnect('google');

    expect(disconnected).toHaveLength(1);
    expect(disconnected[0].provider).toBe('google');
    expect(service.getConnections()).toHaveLength(0);
    expect(mockSaveConnections).toHaveBeenCalledWith('user-123', [], expect.any(Function));
  });

  it('CAL-010: getPollingStatus returns not polling by default', () => {
    const status = service.getPollingStatus();
    expect(status.isPolling).toBe(false);
    expect(status.inWorkHours).toBe(false);
    expect(status.currentEvent).toBeNull();
  });
});
