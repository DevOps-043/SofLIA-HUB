import type {
  WorkflowActionRecord,
  WorkflowDependencies,
} from '../types';

export async function executeGmailLabelsAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  const result = await deps.gmailService.modifyLabels(
    String(action.payload.messageId || ''),
    Array.isArray(action.payload.addLabels) ? action.payload.addLabels : [],
    Array.isArray(action.payload.removeLabels) ? action.payload.removeLabels : [],
  );
  if (!result.success) throw new Error(result.error || 'No se pudieron aplicar etiquetas en Gmail.');
  return result;
}

export async function executeGmailSendLikeAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
  fallbackError: string,
): Promise<Record<string, any>> {
  const result = await deps.gmailService.sendEmail({
    to: Array.isArray(action.payload.to) ? action.payload.to : [],
    subject: String(action.payload.subject || ''),
    body: String(action.payload.body || ''),
  });
  if (!result.success) throw new Error(result.error || fallbackError);
  return result;
}

export async function executeCalendarEventAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  const result = await deps.calendarService.createEvent({
    title: String(action.payload.title || ''),
    start: new Date(String(action.payload.start || '')),
    end: new Date(String(action.payload.end || '')),
    description: String(action.payload.description || ''),
    location: String(action.payload.location || ''),
  });
  if (!result.success) throw new Error(result.error || 'No se pudo crear el evento de calendario.');
  return result;
}

export async function executeGChatMessageAction(
  deps: WorkflowDependencies,
  action: WorkflowActionRecord,
): Promise<Record<string, any>> {
  const result = await deps.gchatService.sendMessage(
    String(action.payload.spaceName || ''),
    String(action.payload.text || ''),
  );
  if (!result.success) throw new Error(result.error || 'No se pudo enviar el mensaje a Google Chat.');
  return result;
}
