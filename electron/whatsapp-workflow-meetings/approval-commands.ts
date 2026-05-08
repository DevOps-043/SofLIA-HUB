import type { MeetingWhatsAppWorkflow } from './workflow';
import {
  formatStatus,
  shouldCloseWorkflow,
} from './formatters';

export async function approveSummaryCommand(workflow: MeetingWhatsAppWorkflow): Promise<boolean> {
  const detail = await workflow.workflowService.approveAsset(
    workflow.runId!,
    workflow.senderNumber,
    'Aprobado desde WhatsApp',
  );
  return sendApprovalStatus(workflow, 'Resumen aprobado.', detail);
}

export async function approveActionsCommand(workflow: MeetingWhatsAppWorkflow): Promise<boolean> {
  const detail = await workflow.workflowService.approveActions(
    workflow.runId!,
    workflow.senderNumber,
    undefined,
    'Acciones aprobadas desde WhatsApp',
  );
  return sendApprovalStatus(workflow, 'Acciones aprobadas.', detail);
}

async function sendApprovalStatus(
  workflow: MeetingWhatsAppWorkflow,
  prefix: string,
  detail: Awaited<ReturnType<MeetingWhatsAppWorkflow['workflowService']['getRunDetail']>>,
): Promise<boolean> {
  const shouldClose = shouldCloseWorkflow(detail);
  if (!shouldClose) workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(
    workflow.jid,
    `${prefix}\n\n${formatStatus(detail)}${shouldClose ? '\n\nWorkflow de reuniones finalizado. Ya puedes volver a preguntarme lo que necesites.' : ''}`,
  );
  return !shouldClose;
}
