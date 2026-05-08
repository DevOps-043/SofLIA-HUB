import {
  clearStoredMeetingAutoSession,
  writeStoredMeetingAutoSession,
  type BrowserMeetingTriggerPayload,
} from '../meeting-auto-session-store';
import { getMonitoringStatus, startMonitoringSession, stopMonitoringSession } from '../monitoring-service';
import { getSessionLabel, getSourceRef, getStoredSessionForUser, hasTriggerIdentity, matchesStoredSession } from './matching';
import type { MeetingTriggerHandlingResult } from './types';

export async function handleStartOrHeartbeat(
  userId: string,
  payload: BrowserMeetingTriggerPayload,
): Promise<MeetingTriggerHandlingResult> {
  const monitoringStatus = await getMonitoringStatus();
  const stored = getStoredSessionForUser(userId);

  if (monitoringStatus.isRunning) {
    if (stored?.sessionId && monitoringStatus.sessionId === stored.sessionId && matchesStoredSession(userId, payload, stored)) {
      if (payload.action === 'heartbeat') writeStoredMeetingAutoSession({ ...stored, rawTrigger: payload });
      return { kind: 'noop', message: 'La trazabilidad de esa reunion ya estaba activa.' };
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
  return { kind: 'started', message: `Inicie la trazabilidad de reunion para ${getSessionLabel(payload)}.` };
}

export async function handleStop(
  userId: string,
  payload: BrowserMeetingTriggerPayload,
): Promise<MeetingTriggerHandlingResult> {
  const stored = getStoredSessionForUser(userId);
  const monitoringStatus = await getMonitoringStatus();
  if (!stored) return { kind: 'noop', message: 'No habia una sesion de reunion activa para cerrar.' };

  if (!monitoringStatus.isRunning || monitoringStatus.sessionId !== stored.sessionId) {
    clearStoredMeetingAutoSession();
    return { kind: 'noop', message: 'La sesion de reunion ya no estaba corriendo. Limpie el estado local.' };
  }
  if (hasTriggerIdentity(payload) && !matchesStoredSession(userId, payload, stored)) {
    return { kind: 'noop', message: 'Recibi un stop de reunion, pero no coincide con la sesion activa.' };
  }

  await stopMonitoringSession(stored.sessionId, userId);
  clearStoredMeetingAutoSession();
  return {
    kind: 'stopped',
    message: `Cerre la trazabilidad de reunion para ${stored.meetingTitle || stored.meetingCode || 'la sesion activa'}.`,
  };
}
