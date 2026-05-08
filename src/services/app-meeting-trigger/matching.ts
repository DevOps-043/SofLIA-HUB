import {
  readStoredMeetingAutoSession,
  type BrowserMeetingTriggerPayload,
} from '../meeting-auto-session-store';

export function normalizeForMatch(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function getSourceRef(payload: BrowserMeetingTriggerPayload): string | null {
  return payload.meetingUrl || payload.tabUrl || null;
}

export function getSessionLabel(payload: BrowserMeetingTriggerPayload): string {
  return payload.meetingTitle || payload.meetingCode || 'Reunion detectada por extension';
}

export function hasTriggerIdentity(payload: BrowserMeetingTriggerPayload): boolean {
  return Boolean(payload.triggerId || payload.meetingCode || getSourceRef(payload) || payload.meetingTitle);
}

export function getStoredSessionForUser(userId: string) {
  const stored = readStoredMeetingAutoSession();
  return stored && stored.userId === userId ? stored : null;
}

export function matchesStoredSession(
  userId: string,
  payload: BrowserMeetingTriggerPayload,
  storedSession = getStoredSessionForUser(userId),
): boolean {
  const stored = storedSession;
  if (!stored) return false;
  if (payload.triggerId && stored.triggerId && payload.triggerId === stored.triggerId) return true;

  const payloadCode = normalizeForMatch(payload.meetingCode);
  const storedCode = normalizeForMatch(stored.meetingCode);
  if (payloadCode && storedCode && payloadCode === storedCode) return true;

  const payloadSourceRef = normalizeForMatch(getSourceRef(payload));
  const storedSourceRef = normalizeForMatch(stored.sourceRef);
  if (payloadSourceRef && storedSourceRef && payloadSourceRef === storedSourceRef) return true;

  const payloadTitle = normalizeForMatch(payload.meetingTitle);
  const storedTitle = normalizeForMatch(stored.meetingTitle);
  return Boolean(payloadTitle && storedTitle && payloadTitle === storedTitle);
}
