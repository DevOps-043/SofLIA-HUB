import type { WhatsAppService } from '../whatsapp-service';
import type { WorkflowHubService } from '../workflow-hub-service';
import { MeetingWorkflowManager } from '../whatsapp-workflow-meetings';
import { WorkflowManager } from '../whatsapp-workflow-presentacion';
import { tryHandlePassiveWorkflowRequest } from './passive-workflows';
import type { PendingConfirmation } from './types';

type HandleChatCommand = (
  jid: string,
  senderNumber: string,
  text: string,
  isGroup: boolean,
) => Promise<string | null>;

type RunAgentLoop = (
  jid: string,
  senderNumber: string,
  text: string,
  isGroup: boolean,
  groupPassiveHistory: string,
) => Promise<string>;

export async function handleWhatsAppTextMessage(input: {
  waService: WhatsAppService;
  workflowHubService: WorkflowHubService | null;
  conversations: Map<string, unknown>;
  pendingConfirmations: Map<string, PendingConfirmation>;
  handleChatCommand: HandleChatCommand;
  runAgentLoop: RunAgentLoop;
  jid: string;
  senderNumber: string;
  text: string;
  isGroup: boolean;
  groupPassiveHistory: string;
}): Promise<void> {
  const text = input.text.trim();
  if (!text) return;

  const sessionKey = input.isGroup ? `group:${input.jid}:${input.senderNumber}` : input.senderNumber;
  if (MeetingWorkflowManager.isActive(sessionKey)) {
    await MeetingWorkflowManager.handleMessage(sessionKey, text);
    return;
  }
  if (WorkflowManager.isActive(sessionKey)) {
    await WorkflowManager.handleMessage(sessionKey, text);
    return;
  }

  const pending = input.pendingConfirmations.get(input.senderNumber);
  if (pending) {
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const confirmed = lower === 'si' || lower === 'yes' || lower === 'confirmar' || lower === 'confirmo';
    clearTimeout(pending.timeout);
    input.pendingConfirmations.delete(input.senderNumber);
    pending.resolve(confirmed);
    return;
  }

  if (text.startsWith('/')) {
    try {
      const commandResult = await input.handleChatCommand(input.jid, input.senderNumber, text, input.isGroup);
      if (commandResult) {
        await input.waService.sendText(input.jid, commandResult);
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No pude ejecutar ese comando.';
      await input.waService.sendText(input.jid, `No pude completar ese comando.\n${message}`);
      return;
    }
    if (WorkflowManager.isActive(sessionKey) || MeetingWorkflowManager.isActive(sessionKey)) return;
  }

  const passiveWorkflowReply = tryHandlePassiveWorkflowRequest({
    workflowHubService: input.workflowHubService,
    senderNumber: input.senderNumber,
    text,
    isGroup: input.isGroup,
  });
  if (passiveWorkflowReply) {
    await input.waService.sendText(input.jid, passiveWorkflowReply);
    return;
  }

  try {
    const response = await input.runAgentLoop(
      input.jid,
      input.senderNumber,
      text,
      input.isGroup,
      input.groupPassiveHistory,
    );
    if (response) await input.waService.sendText(input.jid, response);
  } catch (err: any) {
    console.error('[WhatsApp Agent] Error:', err);
    input.conversations.delete(sessionKey);
    console.warn(`[WhatsApp Agent] Auto-reset conversation for ${sessionKey} after error`);
    await input.waService.sendText(input.jid, 'Ocurrió un error. He reiniciado la conversación. Intenta de nuevo.');
  }
}
