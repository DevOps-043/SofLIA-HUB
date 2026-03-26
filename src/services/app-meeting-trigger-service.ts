import {
  clearStoredMeetingAutoSession,
  readStoredMeetingAutoSession,
  writeStoredMeetingAutoSession,
  type BrowserMeetingTriggerPayload,
} from './meeting-auto-session-store';
import { getMonitoringStatus, startMonitoringSession, stopMonitoringSession } from './monitoring-service';

export interface MeetingTriggerHandlingResult {
  kind: 'started' | 'stopped' | 'noop' | 'busy' | 'error';
  message: string;
}

function makeTriggerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `meeting-trigger-${Date.now()}`;
}

function normalizeString(value: unknown): string | null {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : null;
}

function normalizeTriggerPayload(payload: unknown): BrowserMeetingTriggerPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const input = payload as Record<string, unknown>;
  const action = normalizeString(input.action)?.toLowerCase();
  const normalizedAction: BrowserMeetingTriggerPayload['action'] =
    action === 'stop' || action === 'heartbeat' ? action : 'start';

  const triggerId = normalizeString(input.triggerId) || makeTriggerId();
  const rawUrl = normalizeString(input.rawUrl) || `soflia://meeting-trigger?action=${normalizedAction}`;

  return {
    action: normalizedAction,
    provider: normalizeString(input.provider),
    meetingTitle: normalizeString(input.meetingTitle),
    meetingUrl: normalizeString(input.meetingUrl),
    meetingCode: normalizeString(input.meetingCode),
    tabUrl: normalizeString(input.tabUrl),
    tabId: normalizeString(input.tabId),
    detectedAt: normalizeString(input.detectedAt) || new Date().toISOString(),
    source: normalizeString(input.source),
    reason: normalizeString(input.reason),
    extensionVersion: normalizeString(input.extensionVersion),
    browser: normalizeString(input.browser),
    triggerId,
    rawUrl,
  };
}

function normalizeForMatch(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getSourceRef(payload: BrowserMeetingTriggerPayload): string | null {
  return payload.meetingUrl || payload.tabUrl || null;
}

function getSessionLabel(payload: BrowserMeetingTriggerPayload): string {
  return payload.meetingTitle || payload.meetingCode || 'Reunion detectada por extension';
}

function hasTriggerIdentity(payload: BrowserMeetingTriggerPayload): boolean {
  return Boolean(payload.triggerId || payload.meetingCode || getSourceRef(payload) || payload.meetingTitle);
}

function getStoredSessionForUser(userId: string) {
  const stored = readStoredMeetingAutoSession();
  if (!stored || stored.userId !== userId) {
    return null;
  }
  return stored;
}

function matchesStoredSession(
  userId: string,
  payload: BrowserMeetingTriggerPayload,
  storedSession = getStoredSessionForUser(userId),
): boolean {
  const stored = storedSession;
  if (!stored) {
    return false;
  }

  if (payload.triggerId && stored.triggerId && payload.triggerId === stored.triggerId) {
    return true;
  }

  const payloadCode = normalizeForMatch(payload.meetingCode);
  const storedCode = normalizeForMatch(stored.meetingCode);
  if (payloadCode && storedCode && payloadCode === storedCode) {
    return true;
  }

  const payloadSourceRef = normalizeForMatch(getSourceRef(payload));
  const storedSourceRef = normalizeForMatch(stored.sourceRef);
  if (payloadSourceRef && storedSourceRef && payloadSourceRef === storedSourceRef) {
    return true;
  }

  const payloadTitle = normalizeForMatch(payload.meetingTitle);
  const storedTitle = normalizeForMatch(stored.meetingTitle);
  return Boolean(payloadTitle && storedTitle && payloadTitle === storedTitle);
}

async function handleStartOrHeartbeat(userId: string, payload: BrowserMeetingTriggerPayload): Promise<MeetingTriggerHandlingResult> {
  const monitoringStatus = await getMonitoringStatus();
  const stored = getStoredSessionForUser(userId);

  if (monitoringStatus.isRunning) {
    if (stored?.sessionId && monitoringStatus.sessionId === stored.sessionId && matchesStoredSession(userId, payload, stored)) {
      if (payload.action === 'heartbeat') {
        writeStoredMeetingAutoSession({
          ...stored,
          rawTrigger: payload,
        });
      }

      return {
        kind: 'noop',
        message: 'La trazabilidad de esa reunion ya estaba activa.',
      };
    }

    return {
      kind: 'busy',
      message: 'Ya habia una sesion de monitoreo activa. No la interrumpi con el trigger de la extension.',
    };
  }

  const session = await startMonitoringSession(userId, 'meeting_auto', getSessionLabel(payload));
  writeStoredMeetingAutoSession({
    sessionId: session.id,
    userId,
    meetingTitle: payload.meetingTitle,
    meetingCode: payload.meetingCode,
    sourceRef: getSourceRef(payload),
    provider: payload.provider,
    triggerId: payload.triggerId,
    startedAt: new Date().toISOString(),
    rawTrigger: payload,
  });

  return {
    kind: 'started',
    message: `Inicie la trazabilidad de reunion para ${getSessionLabel(payload)}.`,
  };
}

async function handleStop(userId: string, payload: BrowserMeetingTriggerPayload): Promise<MeetingTriggerHandlingResult> {
  const stored = getStoredSessionForUser(userId);
  const monitoringStatus = await getMonitoringStatus();

  if (!stored) {
    return {
      kind: 'noop',
      message: 'No habia una sesion de reunion activa para cerrar.',
    };
  }

  if (!monitoringStatus.isRunning || monitoringStatus.sessionId !== stored.sessionId) {
    clearStoredMeetingAutoSession();
    return {
      kind: 'noop',
      message: 'La sesion de reunion ya no estaba corriendo. Limpie el estado local.',
    };
  }

  if (hasTriggerIdentity(payload) && !matchesStoredSession(userId, payload, stored)) {
    return {
      kind: 'noop',
      message: 'Recibi un stop de reunion, pero no coincide con la sesion activa.',
    };
  }

  await stopMonitoringSession(stored.sessionId, userId);
  clearStoredMeetingAutoSession();
  return {
    kind: 'stopped',
    message: `Cerre la trazabilidad de reunion para ${stored.meetingTitle || stored.meetingCode || 'la sesion activa'}.`,
  };
}

export async function handleAppMeetingTrigger(userId: string, payload: unknown): Promise<MeetingTriggerHandlingResult> {
  const normalizedPayload = normalizeTriggerPayload(payload);
  if (!normalizedPayload) {
    return {
      kind: 'error',
      message: 'Llego un trigger de reunion invalido desde la extension.',
    };
  }

  if (normalizedPayload.action === 'stop') {
    return handleStop(userId, normalizedPayload);
  }

  return handleStartOrHeartbeat(userId, normalizedPayload);
}
