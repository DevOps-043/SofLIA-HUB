import { useState } from 'react';
import { useAgentActivityPanel } from '../../../components/agents/agent-activity-context';
import type { ChatMessage } from '../../../services/chat-service';
import type { AvatarExpression } from '../../../components/avatar/avatar-model';

/** Consume el snapshot autenticado existente y exige vínculo con el mensaje visible. */
export function useChatBackgroundPresence(messages: ChatMessage[], conversationId?: string | null, activityVersion = 0) {
  const panel = useAgentActivityPanel();
  const ids = new Set(messages.filter(message => message.role === 'model').map(message => message.id));
  const jobs = (panel?.items ?? []).filter(item => item.execution?.messageId && ids.has(item.execution.messageId)
    && (item.execution.conversationId === conversationId || item.execution.conversationId.startsWith('borrador:')));
  const active = jobs.some(item => ['queued', 'running', 'verifying'].includes(item.execution!.status));
  const positions = new Map(messages.map((message, index) => [message.id, index]));
  const latest = jobs.sort((a, b) => (positions.get(a.execution!.messageId!) ?? -1) - (positions.get(b.execution!.messageId!) ?? -1))[jobs.length - 1]?.execution;
  let expression: AvatarExpression | undefined;
  if (latest?.status === 'completed') expression = latest.artifacts.every(artifact => artifact.verified) ? 'success' : 'concerned';
  else if (latest && ['failed', 'interrupted'].includes(latest.status)) expression = 'concerned';
  else if (latest?.status === 'paused') expression = 'confused';
  const key = latest ? `equipo:${latest.id}:${latest.status}` : '';
  const [event, setEvent] = useState<{ key: string; outcome?: { key: string; expression: AvatarExpression; activityVersion: number } }>({ key });
  if (event.key !== key) setEvent({ key, outcome: latest && expression ? { key, expression, activityVersion } : undefined });
  return { active, outcome: event.key === key && event.outcome?.activityVersion === activityVersion ? event.outcome : undefined };
}
