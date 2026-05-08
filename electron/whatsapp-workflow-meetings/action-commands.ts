import { parseMeetingActionUpdates } from './action-updates';
import {
  formatActionList,
  getActionByNumber,
} from './formatters';
import type { MeetingWhatsAppWorkflow } from './workflow';

export async function approveSingleActionCommand(
  workflow: MeetingWhatsAppWorkflow,
  actionNumber: number,
): Promise<boolean> {
  const action = getActionByNumber(await workflow.workflowService.getRunDetail(workflow.runId!), actionNumber);
  if (!action) {
    workflow.scheduleInactivityTimeout();
    await workflow.waService.sendText(workflow.jid, 'No encontre ese numero de accion.');
    return true;
  }

  const detail = await workflow.workflowService.approveActions(
    workflow.runId!,
    workflow.senderNumber,
    [action.id],
    'Accion aprobada desde WhatsApp',
  );
  workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(workflow.jid, `Accion ${actionNumber} aprobada.\n\n${formatActionList(detail)}`);
  return true;
}

export async function editActionCommand(
  workflow: MeetingWhatsAppWorkflow,
  actionNumber: number,
  rawUpdates: string,
): Promise<boolean> {
  const detail = await workflow.workflowService.getRunDetail(workflow.runId!);
  const action = getActionByNumber(detail, actionNumber);
  if (!action) {
    workflow.scheduleInactivityTimeout();
    await workflow.waService.sendText(workflow.jid, 'No encontre ese numero de accion.');
    return true;
  }

  const updates = parseMeetingActionUpdates(rawUpdates);
  if (Object.keys(updates).length === 0) {
    workflow.scheduleInactivityTimeout();
    await workflow.waService.sendText(
      workflow.jid,
      'No detecte cambios validos. Usa por ejemplo: editar accion 1 titulo="Preparar minuta" fecha=2026-03-20 team=TEAM_ID proyecto=PROJECT_ID responsable="Juan Perez" assignee=USER_ID',
    );
    return true;
  }

  const updatedDetail = await workflow.workflowService.updateAction(action.id, updates);
  workflow.scheduleInactivityTimeout();
  await workflow.waService.sendText(workflow.jid, `Accion ${actionNumber} actualizada.\n\n${formatActionList(updatedDetail)}`);
  return true;
}
