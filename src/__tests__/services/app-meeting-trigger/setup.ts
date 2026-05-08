import { vi } from 'vitest';

export const mockGetMonitoringStatus = vi.fn();
export const mockStartMonitoringSession = vi.fn();
export const mockStopMonitoringSession = vi.fn();

vi.doMock('../../../services/monitoring-service', () => ({
  getMonitoringStatus: mockGetMonitoringStatus,
  startMonitoringSession: mockStartMonitoringSession,
  stopMonitoringSession: mockStopMonitoringSession,
}));

export function resetMeetingTriggerMocks(): void {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
}

export async function loadMeetingTriggerModules() {
  const trigger = await import('../../../services/app-meeting-trigger-service');
  const store = await import('../../../services/meeting-auto-session-store');
  return {
    handleAppMeetingTrigger: trigger.handleAppMeetingTrigger,
    readStoredMeetingAutoSession: store.readStoredMeetingAutoSession,
  };
}
