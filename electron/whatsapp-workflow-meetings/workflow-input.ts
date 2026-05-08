import { approveActionsCommand, approveSummaryCommand } from './approval-commands';
import { approveSingleActionCommand, editActionCommand } from './action-commands';
import { CANCEL_WORKFLOW_PATTERN, REJECT_WORKFLOW_PATTERN } from './constants';
import {
  formatActionList,
  formatRunDetail,
  formatStatus,
  formatSyncResult,
  shouldCloseWorkflow,
} from './formatters';
import { buildUnknownInstructionMessage } from './workflow-messages';
import { importMeetingWorkflowSource } from './workflow-source';
import type { MeetingWhatsAppWorkflow } from './workflow';

export async function handleMeetingWorkflowInput(
  workflow: MeetingWhatsAppWorkflow,
  text: string,
): Promise<boolean> {
  const lower = text.trim().toLowerCase();
  try {
    if (CANCEL_WORKFLOW_PATTERN.test(lower)) return cancelMeetingWorkflow(workflow, lower);
    if (!workflow.runId) return importInitialSource(workflow, text);
    if (lower === 'estado') return sendStatus(workflow);
    if (lower === 'acciones') return sendActions(workflow);
    if (lower === 'aprobar resumen') return approveSummaryCommand(workflow);
    if (lower === 'aprobar acciones') return approveActionsCommand(workflow);
    if (lower === 'sincronizar') return syncApprovedActions(workflow);

    const approveSingleMatch = lower.match(/^aprobar accion\s+(\d+)$/);
    if (approveSingleMatch) return approveSingleActionCommand(workflow, Number(approveSingleMatch[1]));

    const editMatch = text.trim().match(/^editar accion\s+(\d+)\s+(.+)$/i);
    if (editMatch) return editActionCommand(workflow, Number(editMatch[1]), editMatch[2]);

    await workflow.waService.sendText(workflow.jid, await buildUnknownInstructionMessage(workflow.workflowService, workflow.runId));
    const shouldStayOpen = !shouldCloseWorkflow(await workflow.workflowService.getRunDetail(workflow.runId));
    if (shouldStayOpen) workflow.scheduleInactivityTimeout();
    return shouldStayOpen;
  } catch (error: any) {
    workflow.scheduleInactivityTimeout();
    await workflow.waService.sendText(workflow.jid, `No pude completar la accion: ${error?.message || String(error)}`);
    return true;
  }
}

function cancelMeetingWorkflow(workflow: MeetingWhatsAppWorkflow, lower: string): Promise<boolean> {
  const message = REJECT_WORKFLOW_PATTERN.test(lower)
    ? 'Workflow de reuniones rechazado. No sincronice nada y deje el run listo para revision manual.'
    : 'Workflow de reuniones cancelado.';
  return workflow.cancelWorkflow(message);
}

async function importInitialSource(workflow: MeetingWhatsAppWorkflow, text: string): Promise<boolean> {
  const result = await importMeetingWorkflowSource(workflow.workflowService, workflow.senderNumber, text);
  workflow.runId = result.detail.run.id;
  workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(workflow.jid, formatRunDetail(result.detail, result.deduplicated));
  return true;
}

async function sendStatus(workflow: MeetingWhatsAppWorkflow): Promise<boolean> {
  workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(workflow.jid, formatStatus(await workflow.workflowService.getRunDetail(workflow.runId!)));
  return true;
}

async function sendActions(workflow: MeetingWhatsAppWorkflow): Promise<boolean> {
  workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(workflow.jid, formatActionList(await workflow.workflowService.getRunDetail(workflow.runId!)));
  return true;
}

async function syncApprovedActions(workflow: MeetingWhatsAppWorkflow): Promise<boolean> {
  const syncResult = await workflow.workflowService.syncApprovedActions(workflow.runId!, workflow.senderNumber);
  await workflow.waService.sendText(workflow.jid, formatSyncResult(syncResult.detail, syncResult.result));
  return false;
}
