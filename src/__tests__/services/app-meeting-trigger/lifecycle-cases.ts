import { expect, it } from 'vitest';
import {
  mockGetMonitoringStatus,
  mockStartMonitoringSession,
  mockStopMonitoringSession,
} from './setup';
import { storeMeetingAutoSession } from './stored-session';

async function importTriggerModules() {
  const trigger = await import('../../../services/app-meeting-trigger-service');
  const store = await import('../../../services/meeting-auto-session-store');
  return { handleAppMeetingTrigger: trigger.handleAppMeetingTrigger, readStoredMeetingAutoSession: store.readStoredMeetingAutoSession };
}

export function registerMeetingTriggerLifecycleTests() {
  it('ATM-003: unrelated active monitoring session leaves meeting trigger as busy', async () => {
    mockGetMonitoringStatus.mockResolvedValue({ isRunning: true, sessionId: 'session-other', userId: 'user-1', snapshotCount: 2, config: {} });
    const { handleAppMeetingTrigger } = await importTriggerModules();

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'start',
      meetingTitle: 'Planning',
      meetingCode: 'zzz-111',
      rawUrl: 'soflia://meeting-trigger?action=start',
    });

    expect(result.kind).toBe('busy');
    expect(mockStartMonitoringSession).not.toHaveBeenCalled();
  });

  it('ATM-004: stop closes the owned stored meeting session and clears local state', async () => {
    storeMeetingAutoSession();
    mockGetMonitoringStatus.mockResolvedValue({ isRunning: true, sessionId: 'session-123', userId: 'user-1', snapshotCount: 8, config: {} });
    const { handleAppMeetingTrigger, readStoredMeetingAutoSession } = await importTriggerModules();

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'stop',
      meetingTitle: 'Daily Sync',
      meetingCode: 'abc-def',
      triggerId: 'trigger-1',
      rawUrl: 'soflia://meeting-trigger?action=stop',
    });

    expect(result.kind).toBe('stopped');
    expect(mockStopMonitoringSession).toHaveBeenCalledWith('session-123', 'user-1');
    expect(readStoredMeetingAutoSession()).toBeNull();
  });

  it('ATM-005: ignores stored sessions that belong to another user', async () => {
    storeMeetingAutoSession({
      sessionId: 'session-foreign',
      userId: 'user-2',
      meetingTitle: 'Foreign Meeting',
      meetingCode: 'foreign-123',
      sourceRef: 'https://meet.google.com/foreign-123',
      triggerId: 'trigger-foreign',
    });
    mockGetMonitoringStatus.mockResolvedValue({ isRunning: false, sessionId: null, userId: null, snapshotCount: 0, config: {} });
    mockStartMonitoringSession.mockResolvedValue({ id: 'session-new' });
    const { handleAppMeetingTrigger, readStoredMeetingAutoSession } = await importTriggerModules();

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'start',
      meetingTitle: 'My Meeting',
      meetingCode: 'mine-123',
      triggerId: 'trigger-mine',
      rawUrl: 'soflia://meeting-trigger?action=start',
    });

    expect(result.kind).toBe('started');
    expect(mockStartMonitoringSession).toHaveBeenCalledWith('user-1', 'meeting_auto', 'My Meeting');
    expect(readStoredMeetingAutoSession()).toEqual(expect.objectContaining({ userId: 'user-1', sessionId: 'session-new' }));
  });
}
