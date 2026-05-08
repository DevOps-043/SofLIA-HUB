type StoredSessionOverrides = {
  sessionId?: string;
  userId?: string;
  meetingTitle?: string;
  meetingCode?: string;
  sourceRef?: string;
  provider?: string;
  triggerId?: string;
};

export function storeMeetingAutoSession(overrides: StoredSessionOverrides = {}): void {
  const sessionId = overrides.sessionId || 'session-123';
  const userId = overrides.userId || 'user-1';
  const meetingTitle = overrides.meetingTitle || 'Daily Sync';
  const meetingCode = overrides.meetingCode || 'abc-def';
  const sourceRef = overrides.sourceRef || `https://meet.google.com/${meetingCode}`;
  const provider = overrides.provider || 'google_meet';
  const triggerId = overrides.triggerId || 'trigger-1';

  localStorage.setItem(
    'soflia_meeting_auto_session',
    JSON.stringify({
      sessionId,
      userId,
      meetingTitle,
      meetingCode,
      sourceRef,
      provider,
      triggerId,
      startedAt: '2026-03-26T00:00:00.000Z',
      rawTrigger: {
        action: 'start',
        provider,
        meetingTitle,
        meetingUrl: sourceRef,
        meetingCode,
        tabUrl: sourceRef,
        tabId: '1',
        detectedAt: '2026-03-26T00:00:00.000Z',
        source: 'extension',
        reason: null,
        extensionVersion: '1.0.0',
        browser: 'chrome',
        triggerId,
        rawUrl: 'soflia://meeting-trigger?action=start',
      },
    }),
  );
}
