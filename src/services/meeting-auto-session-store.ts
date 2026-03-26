export type BrowserMeetingTriggerAction = 'start' | 'stop' | 'heartbeat';

export interface BrowserMeetingTriggerPayload {
  action: BrowserMeetingTriggerAction;
  provider: string | null;
  meetingTitle: string | null;
  meetingUrl: string | null;
  meetingCode: string | null;
  tabUrl: string | null;
  tabId: string | null;
  detectedAt: string;
  source: string | null;
  reason: string | null;
  extensionVersion: string | null;
  browser: string | null;
  triggerId: string;
  rawUrl: string;
}

export interface StoredMeetingAutoSession {
  sessionId: string;
  userId: string;
  meetingTitle: string | null;
  meetingCode: string | null;
  sourceRef: string | null;
  provider: string | null;
  triggerId: string | null;
  startedAt: string;
  rawTrigger: BrowserMeetingTriggerPayload;
}

const STORAGE_KEY = 'soflia_meeting_auto_session';

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredMeetingAutoSession(): StoredMeetingAutoSession | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredMeetingAutoSession;
  } catch {
    return null;
  }
}

export function writeStoredMeetingAutoSession(session: StoredMeetingAutoSession): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore local persistence failures to avoid breaking the session.
  }
}

export function clearStoredMeetingAutoSession(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore local persistence failures to avoid breaking the session.
  }
}

export function buildMeetingAutoLogMetadata(sessionId: string): Record<string, unknown> | undefined {
  const session = readStoredMeetingAutoSession();
  if (!session || session.sessionId !== sessionId) {
    return undefined;
  }

  return {
    source: 'meeting_auto',
    trigger_origin: 'browser_extension',
    meeting_title: session.meetingTitle,
    meeting_code: session.meetingCode,
    source_ref: session.sourceRef,
    provider: session.provider,
    trigger_id: session.triggerId,
    started_at: session.startedAt,
    browser: session.rawTrigger.browser,
    extension_version: session.rawTrigger.extensionVersion,
    tab_url: session.rawTrigger.tabUrl,
    tab_id: session.rawTrigger.tabId,
    trigger_reason: session.rawTrigger.reason,
    trigger_source: session.rawTrigger.source,
  };
}
