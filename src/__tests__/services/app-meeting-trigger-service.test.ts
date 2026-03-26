import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMonitoringStatus = vi.fn();
const mockStartMonitoringSession = vi.fn();
const mockStopMonitoringSession = vi.fn();

vi.mock('../../services/monitoring-service', () => ({
  getMonitoringStatus: mockGetMonitoringStatus,
  startMonitoringSession: mockStartMonitoringSession,
  stopMonitoringSession: mockStopMonitoringSession,
}));

describe('app-meeting-trigger-service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('ATM-001: starts a meeting_auto session and persists trigger context', async () => {
    mockGetMonitoringStatus.mockResolvedValue({
      isRunning: false,
      sessionId: null,
      userId: null,
      snapshotCount: 0,
      config: {},
    });
    mockStartMonitoringSession.mockResolvedValue({
      id: 'session-123',
    });

    const { handleAppMeetingTrigger } = await import('../../services/app-meeting-trigger-service');
    const { readStoredMeetingAutoSession } = await import('../../services/meeting-auto-session-store');

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
    expect(readStoredMeetingAutoSession()).toEqual(
      expect.objectContaining({
        sessionId: 'session-123',
        userId: 'user-1',
        meetingTitle: 'Daily Sync',
        meetingCode: 'abc-def',
        triggerId: 'trigger-1',
      }),
    );
  });

  it('ATM-002: heartbeat on the same stored session becomes noop and refreshes raw trigger', async () => {
    localStorage.setItem(
      'soflia_meeting_auto_session',
      JSON.stringify({
        sessionId: 'session-123',
        userId: 'user-1',
        meetingTitle: 'Daily Sync',
        meetingCode: 'abc-def',
        sourceRef: 'https://meet.google.com/abc-def',
        provider: 'google_meet',
        triggerId: 'trigger-1',
        startedAt: '2026-03-26T00:00:00.000Z',
        rawTrigger: {
          action: 'start',
          provider: 'google_meet',
          meetingTitle: 'Daily Sync',
          meetingUrl: 'https://meet.google.com/abc-def',
          meetingCode: 'abc-def',
          tabUrl: 'https://meet.google.com/abc-def',
          tabId: '1',
          detectedAt: '2026-03-26T00:00:00.000Z',
          source: 'extension',
          reason: null,
          extensionVersion: '1.0.0',
          browser: 'chrome',
          triggerId: 'trigger-1',
          rawUrl: 'soflia://meeting-trigger?action=start',
        },
      }),
    );

    mockGetMonitoringStatus.mockResolvedValue({
      isRunning: true,
      sessionId: 'session-123',
      userId: 'user-1',
      snapshotCount: 4,
      config: {},
    });

    const { handleAppMeetingTrigger } = await import('../../services/app-meeting-trigger-service');
    const { readStoredMeetingAutoSession } = await import('../../services/meeting-auto-session-store');

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

  it('ATM-003: an unrelated active monitoring session leaves meeting trigger as busy', async () => {
    mockGetMonitoringStatus.mockResolvedValue({
      isRunning: true,
      sessionId: 'session-other',
      userId: 'user-1',
      snapshotCount: 2,
      config: {},
    });

    const { handleAppMeetingTrigger } = await import('../../services/app-meeting-trigger-service');

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
    localStorage.setItem(
      'soflia_meeting_auto_session',
      JSON.stringify({
        sessionId: 'session-123',
        userId: 'user-1',
        meetingTitle: 'Daily Sync',
        meetingCode: 'abc-def',
        sourceRef: 'https://meet.google.com/abc-def',
        provider: 'google_meet',
        triggerId: 'trigger-1',
        startedAt: '2026-03-26T00:00:00.000Z',
        rawTrigger: {
          action: 'start',
          provider: 'google_meet',
          meetingTitle: 'Daily Sync',
          meetingUrl: 'https://meet.google.com/abc-def',
          meetingCode: 'abc-def',
          tabUrl: 'https://meet.google.com/abc-def',
          tabId: '1',
          detectedAt: '2026-03-26T00:00:00.000Z',
          source: 'extension',
          reason: null,
          extensionVersion: '1.0.0',
          browser: 'chrome',
          triggerId: 'trigger-1',
          rawUrl: 'soflia://meeting-trigger?action=start',
        },
      }),
    );

    mockGetMonitoringStatus.mockResolvedValue({
      isRunning: true,
      sessionId: 'session-123',
      userId: 'user-1',
      snapshotCount: 8,
      config: {},
    });

    const { handleAppMeetingTrigger } = await import('../../services/app-meeting-trigger-service');
    const { readStoredMeetingAutoSession } = await import('../../services/meeting-auto-session-store');

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
    localStorage.setItem(
      'soflia_meeting_auto_session',
      JSON.stringify({
        sessionId: 'session-foreign',
        userId: 'user-2',
        meetingTitle: 'Foreign Meeting',
        meetingCode: 'foreign-123',
        sourceRef: 'https://meet.google.com/foreign-123',
        provider: 'google_meet',
        triggerId: 'trigger-foreign',
        startedAt: '2026-03-26T00:00:00.000Z',
        rawTrigger: {
          action: 'start',
          provider: 'google_meet',
          meetingTitle: 'Foreign Meeting',
          meetingUrl: 'https://meet.google.com/foreign-123',
          meetingCode: 'foreign-123',
          tabUrl: 'https://meet.google.com/foreign-123',
          tabId: '1',
          detectedAt: '2026-03-26T00:00:00.000Z',
          source: 'extension',
          reason: null,
          extensionVersion: '1.0.0',
          browser: 'chrome',
          triggerId: 'trigger-foreign',
          rawUrl: 'soflia://meeting-trigger?action=start',
        },
      }),
    );

    mockGetMonitoringStatus.mockResolvedValue({
      isRunning: false,
      sessionId: null,
      userId: null,
      snapshotCount: 0,
      config: {},
    });
    mockStartMonitoringSession.mockResolvedValue({
      id: 'session-new',
    });

    const { handleAppMeetingTrigger } = await import('../../services/app-meeting-trigger-service');
    const { readStoredMeetingAutoSession } = await import('../../services/meeting-auto-session-store');

    const result = await handleAppMeetingTrigger('user-1', {
      action: 'start',
      meetingTitle: 'My Meeting',
      meetingCode: 'mine-123',
      triggerId: 'trigger-mine',
      rawUrl: 'soflia://meeting-trigger?action=start',
    });

    expect(result.kind).toBe('started');
    expect(mockStartMonitoringSession).toHaveBeenCalledWith('user-1', 'meeting_auto', 'My Meeting');
    expect(readStoredMeetingAutoSession()).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-new',
      }),
    );
  });
});
