import { parseMeetingActionUpdates } from './action-updates';
import type { MeetingCommandInput, MeetingCommandResult } from './command-types';
import { formatActionList, getActionByNumber } from './formatters';

export async function handleActionCommand(input: MeetingCommandInput): Promise<MeetingCommandResult | null> {
  const approveSingleMatch = input.lower.match(/^aprobar accion\s+(\d+)$/);
  if (approveSingleMatch) {
    return approveSingleAction(input, Number(approveSingleMatch[1]), approveSingleMatch[1]);
  }

  const editMatch = input.text.trim().match(/^editar accion\s+(\d+)\s+(.+)$/i);
  if (editMatch) {
    return editAction(input, Number(editMatch[1]), editMatch[1], editMatch[2]);
  }

  return null;
}

async function approveSingleAction(input: MeetingCommandInput, actionNumber: number, actionLabel: string): Promise<MeetingCommandResult> {
  const action = getActionByNumber(await input.workflowService.getRunDetail(input.runId), actionNumber);
  if (!action) {
    input.refreshTimeout();
    await input.waService.sendText(input.jid, 'No encontre ese numero de accion.');
    return { keepActive: true };
  }

  const detail = await input.workflowService.approveActions(
    input.runId,
    input.senderNumber,
    [action.id],
    'Accion aprobada desde WhatsApp',
  );
  input.refreshTimeout();
  await input.waService.sendText(input.jid, `Accion ${actionLabel} aprobada.\n\n${formatActionList(detail)}`);
  return { keepActive: true };
}

async function editAction(input: MeetingCommandInput, actionNumber: number, actionLabel: string, rawUpdates: string): Promise<MeetingCommandResult> {
  const detail = await input.workflowService.getRunDetail(input.runId);
  const action = getActionByNumber(detail, actionNumber);
  if (!action) {
    input.refreshTimeout();
    await input.waService.sendText(input.jid, 'No encontre ese numero de accion.');
    return { keepActive: true };
  }

  const updates = parseMeetingActionUpdates(rawUpdates);
  if (Object.keys(updates).length === 0) {
    input.refreshTimeout();
    await input.waService.sendText(
      input.jid,
      'No detecte cambios validos. Usa por ejemplo: editar accion 1 titulo="Preparar minuta" fecha=2026-03-20 team=TEAM_ID proyecto=PROJECT_ID responsable="Juan Perez" assignee=USER_ID',
    );
    return { keepActive: true };
  }

  const updatedDetail = await input.workflowService.updateAction(action.id, updates);
  input.refreshTimeout();
  await input.waService.sendText(input.jid, `Accion ${actionLabel} actualizada.\n\n${formatActionList(updatedDetail)}`);
  return { keepActive: true };
}
