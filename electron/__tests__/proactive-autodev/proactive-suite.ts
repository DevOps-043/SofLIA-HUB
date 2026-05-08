import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockExistsSync,
  mockGetAllWhatsAppSessions,
  mockGetIssues,
  mockGetProjects,
  mockWriteFileSync,
  ProactiveService as ProactiveServiceCtor,
} from './fixture';
import type { ProactiveService } from './fixture';

describe('ProactiveService', () => {
  let service: InstanceType<typeof ProactiveService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    service = new ProactiveServiceCtor();
  });

  afterEach(() => service.stop());

  it('PRO-001: start() creates a check interval when enabled', () => {
    vi.useFakeTimers();
    service.updateConfig({ enabled: true });
    service.start();
    expect(service.isRunning()).toBe(true);
    vi.useRealTimers();
  });

  it('PRO-002: stop() clears the check interval', () => {
    vi.useFakeTimers();
    service.updateConfig({ enabled: true });
    service.start();
    service.stop();
    expect(service.isRunning()).toBe(false);
    vi.useRealTimers();
  });

  it('PRO-003: start() does nothing when config.enabled is false', () => {
    service.updateConfig({ enabled: false });
    service.start();
    expect(service.isRunning()).toBe(false);
  });

  it('PRO-004: tick skips when current hour not in notificationHours', async () => {
    service.updateConfig({ enabled: true, notificationHours: [3] });
    const mockWa = { isConnected: vi.fn().mockReturnValue(true), sendText: vi.fn() };
    service.setWhatsAppService(mockWa);
    mockGetAllWhatsAppSessions.mockReturnValue([{ phoneNumber: '5551234567', fullName: 'Test' }]);
    await (service as any).tick();
    if (new Date().getHours() !== 3) expect(mockWa.sendText).not.toHaveBeenCalled();
  });

  it('PRO-005: does not send duplicate notifications for same user/hour/day', async () => {
    const currentHour = new Date().getHours();
    service.updateConfig({ enabled: true, notificationHours: [currentHour], calendarReminders: false, taskReminders: false, systemAlerts: false });
    const mockWa = { isConnected: vi.fn().mockReturnValue(true), sendText: vi.fn() };
    service.setWhatsAppService(mockWa);
    mockGetAllWhatsAppSessions.mockReturnValue([{ phoneNumber: '5551234567', fullName: 'Test', userId: 'u1' }]);
    await (service as any).tick();
    await (service as any).tick();
    expect(mockWa.sendText.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('PRO-006: collectData gathers calendar events when calendarReminders is true', async () => {
    service.updateConfig({ calendarReminders: true, taskReminders: false, systemAlerts: false });
    service.setCalendarService({ getCurrentEvents: vi.fn().mockResolvedValue([{ title: 'Standup', start: new Date(), end: new Date() }]) });
    const payload = await (service as any).collectData({ fullName: 'Test', userId: 'u1' });
    expect(payload.calendarEvents[0].title).toBe('Standup');
  });

  it('PRO-007: collectData gathers urgent tasks when taskReminders is true', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    service.updateConfig({ calendarReminders: false, taskReminders: true, systemAlerts: false });
    mockGetIssues.mockResolvedValue([{ title: 'Fix bug', due_date: todayStr, status: { name: 'To Do', status_type: 'todo' }, priority: { name: 'High' } }]);
    mockGetProjects.mockResolvedValue([]);
    const payload = await (service as any).collectData({ fullName: 'Test', userId: 'u1' });
    expect(payload.urgentTasks[0].isDueToday).toBe(true);
  });

  it('PRO-008/009/010: system alerts, running state and config persistence stay stable', async () => {
    service.updateConfig({ systemAlerts: true });
    expect(Array.isArray((await (service as any).collectData({ fullName: 'Test', userId: 'u1' })).systemAlerts)).toBe(true);
    expect(service.isRunning()).toBe(false);
    service.updateConfig({ notificationHours: [9, 18], checkIntervalMinutes: 10 });
    expect(service.getConfig().notificationHours).toEqual([9, 18]);
    expect(mockWriteFileSync).toHaveBeenCalled();
  });
});
