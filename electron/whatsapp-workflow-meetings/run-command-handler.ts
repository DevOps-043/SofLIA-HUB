import { handleActionCommand } from './action-command-handler';
import type { MeetingCommandInput, MeetingCommandResult } from './command-types';
import { formatActionList, formatStatus, formatSyncResult, shouldCloseWorkflow } from './formatters';
import { buildApprovalMessage } from './messages';

export async function handleMeetingRunCommand(input: MeetingCommandInput): Promise<MeetingCommandResult | null> {
  if (input.lower === 'estado') {
    input.refreshTimeout();
    await input.waService.sendText(input.jid, formatStatus(await input.workflowService.getRunDetail(input.runId)));
    return { keepActive: true };
  }

  if (input.lower === 'acciones') {
    input.refreshTimeout();
    await input.waService.sendText(input.jid, formatActionList(await input.workflowService.getRunDetail(input.runId)));
    return { keepActive: true };
  }

  if (input.lower === 'aprobar resumen') {
    const detail = await input.workflowService.approveAsset(input.runId, input.senderNumber, 'Aprobado desde WhatsApp');
    const shouldClose = shouldCloseWorkflow(detail);
    if (!shouldClose) input.refreshTimeout();
    await input.waService.sendText(input.jid, buildApprovalMessage('Resumen aprobado.', formatStatus(detail), shouldClose));
    return { keepActive: !shouldClose };
  }

  if (input.lower === 'aprobar acciones') {
    const detail = await input.workflowService.approveActions(
      input.runId,
      input.senderNumber,
      undefined,
      'Acciones aprobadas desde WhatsApp',
    );
    const shouldClose = shouldCloseWorkflow(detail);
    if (!shouldClose) input.refreshTimeout();
    await input.waService.sendText(input.jid, buildApprovalMessage('Acciones aprobadas.', formatStatus(detail), shouldClose));
    return { keepActive: !shouldClose };
  }

  const actionResult = await handleActionCommand(input);
  if (actionResult) return actionResult;

  if (input.lower === 'sincronizar') {
    const syncResult = await input.workflowService.syncApprovedActions(input.runId, input.senderNumber);
    await input.waService.sendText(input.jid, formatSyncResult(syncResult.detail, syncResult.result));
    return { keepActive: false };
  }

  return null;
}
