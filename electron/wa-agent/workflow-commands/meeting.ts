import { resolveAutomationBriefDate } from '../automation-resolvers';
import { formatWorkflowCaseResponse } from '../workflow-formatters';
import {
  requireWorkflowHubService,
  requireWorkspaceAutomationConfigured,
  type WorkflowCommandContext,
} from './types';

export async function handleMeetingWorkflowCommand(context: WorkflowCommandContext): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const raw = context.args.join(' ').trim();
  if (!raw) {
    return 'Uso: /reunion pega notas directamente, o /reunion prep 2026-03-22, o /reunion drive | LINK | titulo opcional';
  }

  if (/^prep(\s|$)/i.test(raw)) {
    const targetDate = resolveAutomationBriefDate([raw.replace(/^prep\s*/i, '').trim()].filter(Boolean));
    const detail = await workflowHub.executeWorkflow({
      workflowId: 'reuniones',
      requestedBy: `whatsapp:${context.senderNumber}`,
      input: { mode: 'prep', targetDate },
    });
    return formatWorkflowCaseResponse(detail, 'Listo. Prepare la reunion.');
  }

  if (/^drive(\s*\||\s+)/i.test(raw)) {
    return await handleMeetingDriveCommand(context, raw);
  }

  if (/^auto(\s|$)/i.test(raw)) {
    return 'La deteccion automatica de reuniones corre en segundo plano. Usa /flujos para revisar capacidades y casos detectados.';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'reuniones',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { mode: 'manual', manualText: raw },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Cree el caso de reunion.');
}

export async function handleMeetingPrepCommand(context: WorkflowCommandContext): Promise<string> {
  const missingConfig = requireWorkspaceAutomationConfigured(context.workspaceAutomationService, 'preparar la reunion');
  if (missingConfig) return missingConfig;

  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const targetDate = resolveAutomationBriefDate(context.args);
  const detail = await workflowHub.executeWorkflow({
    workflowId: 'reuniones',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { mode: 'prep', targetDate },
  });
  return formatWorkflowCaseResponse(detail, `Listo. Prepare tu siguiente reunion${targetDate ? ` para ${targetDate}` : ''}.`);
}

async function handleMeetingDriveCommand(
  context: WorkflowCommandContext,
  raw: string,
): Promise<string> {
  const workflowHub = requireWorkflowHubService(context.workflowHubService);
  const rest = raw.replace(/^drive/i, '').trim().replace(/^\|/, '').trim();
  const parts = rest.split('|').map((item) => item.trim()).filter(Boolean);
  const driveRef = parts[0] || '';
  const meetingTitle = parts[1] || '';
  if (!driveRef) {
    return 'Uso: /reunion drive | LINK_O_ID | titulo opcional';
  }

  const detail = await workflowHub.executeWorkflow({
    workflowId: 'reuniones',
    requestedBy: `whatsapp:${context.senderNumber}`,
    input: { mode: 'drive', driveRef, meetingTitle },
  });
  return formatWorkflowCaseResponse(detail, 'Listo. Cree el caso de reunion desde Drive.');
}
