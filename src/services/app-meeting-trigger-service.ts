import { handleStartOrHeartbeat, handleStop } from './app-meeting-trigger/handlers';
import { normalizeTriggerPayload } from './app-meeting-trigger/payload';
import type { MeetingTriggerHandlingResult } from './app-meeting-trigger/types';

export type { MeetingTriggerHandlingResult } from './app-meeting-trigger/types';

export async function handleAppMeetingTrigger(
  userId: string,
  payload: unknown,
): Promise<MeetingTriggerHandlingResult> {
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
