import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadMeetingTriggerModules,
  mockGetMonitoringStatus,
  mockStartMonitoringSession,
  resetMeetingTriggerMocks,
} from './setup';
import { storeMeetingAutoSession } from './stored-session';

describe('app-meeting-trigger-service start and heartbeat', () => {
  beforeEach(resetMeetingTriggerMocks);

  it('ATM-001: starts a meeting_auto session and persists trigger context', async () => {
    mockGetMonitoringStatus.mockResolvedValue({ isRunning: false, sessionId: null, userId: null, snapshotCount: 0, config: {} });
    mockStartMonitoringSession.mockResolvedValue({ id: 'session-123' });
    const { handleAppMeetingTrigger, readStoredMeetingAutoSession } = await loadMeetingTriggerModules();

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'start',
      meetingTitle: 'Daily Sync',
      meetingCode: 'abc-def',
      meetingUrl: 'https://meet.google.com/abc-def',
      triggerId: 'trigger-1',
      provider: 'google_meet',
      rawUrl: 'soflia://meeting-trigger?action=start',
    });

    expect(result.kind).toBe('started');
    expect(mockStartMonitoringSession).toHaveBeenCalledWith('user-1', 'meeting_auto', 'Daily Sync');
    expect(readStoredMeetingAutoSession()).toEqual(expect.objectContaining({
      sessionId: 'session-123',
      userId: 'user-1',
      meetingTitle: 'Daily Sync',
      meetingCode: 'abc-def',
      triggerId: 'trigger-1',
    }));
  });

  it('ATM-002: heartbeat on the same stored session becomes noop and refreshes raw trigger', async () => {
    storeMeetingAutoSession();
    mockGetMonitoringStatus.mockResolvedValue({ isRunning: true, sessionId: 'session-123', userId: 'user-1', snapshotCount: 4, config: {} });
    const { handleAppMeetingTrigger, readStoredMeetingAutoSession } = await loadMeetingTriggerModules();

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'heartbeat',
      meetingTitle: 'Daily Sync',
      meetingCode: 'abc-def',
      meetingUrl: 'https://meet.google.com/abc-def',
      tabUrl: 'https://meet.google.com/abc-def',
      triggerId: 'trigger-1',
      provider: 'google_meet',
      reason: 'heartbeat',
      extensionVersion: '1.0.1',
      rawUrl: 'soflia://meeting-trigger?action=heartbeat',
    });

    expect(result.kind).toBe('noop');
    expect(mockStartMonitoringSession).not.toHaveBeenCalled();
    expect(readStoredMeetingAutoSession()?.rawTrigger.action).toBe('heartbeat');
    expect(readStoredMeetingAutoSession()?.rawTrigger.extensionVersion).toBe('1.0.1');
  });
});
