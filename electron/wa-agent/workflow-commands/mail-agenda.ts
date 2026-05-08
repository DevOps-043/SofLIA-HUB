import { resolveAutomationBriefDate, resolveAutomationMailQuery } from '../automation-resolvers';
import { formatWorkflowCaseResponse } from '../workflow-formatters';
import {
  requireWorkflowHubService,
  requireWorkspaceAutomationConfigured,
  type WorkflowCommandContext,
} from './types';

export async function handleMailReviewCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'revisar correos');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const query = resolveAutomationMailQuery(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'correo',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { preset: 'custom', query, maxResults: 5, removeFromInbox: true },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Prepare una revision ejecutiva de correo.');
}

export async function handleAgendaCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'preparar la agenda');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const targetDate = resolveAutomationBriefDate(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'agenda',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { targetDate },
  });
  return formatWorkflowCaseResponse(detail, `Listo. Prepare tu resumen de agenda${targetDate ? ` para ${targetDate}` : ' de hoy'}.`);
}

export async function handleFollowUpCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'redactar el seguimiento');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  const parts = raw.split('|').map((item) => item.trim());
  const to = parts[0] || '';
  const topic = parts[1] || '';
  const followUpContext = parts[2] || '';
  const tone = parts[3] || '';
  const signature = parts[4] || '';
  if (!to || !topic) {
    return 'Uso: /seguimiento correo@empresa.com | tema | contexto opcional | tono opcional | firma opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'seguimiento',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: {
      to,
      topic,
      context: followUpContext || undefined,
      tone: tone || undefined,
      signature: signature || undefined,
    },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Deje preparado el correo de seguimiento.');
}
