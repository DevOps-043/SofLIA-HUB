import type { WhatsAppService } from '../whatsapp-service';
import type { PassiveSkillsService } from '../passive-skills/service';
import { MeetingWorkflowManager } from '../whatsapp-workflow-meetings';
import { WorkflowManager } from '../whatsapp-workflow-presentacion';
import { tryHandlePassiveSkillRequest } from './passive-skills';
import {
  getWhatsAppAgentUserErrorMessage,
  shouldResetConversationAfterAgentError,
} from './agent-errors';
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
  passiveSkillsService: PassiveSkillsService | null;
  conversations: Map<string, unknown>;
  pendingConfirmations: Map<string, PendingConfirmation>;
  handleChatCommand: HandleChatCommand;
  runAgentLoop: RunAgentLoop;
  jid: string;
  senderNumber: string;
  text: string;
  isGroup: boolean;
  groupPassiveHistory: string;
  /**
   * Entrega de la respuesta final del agente. Se inyecta para que el modo
   * llamada pueda hablarla sin que este manejador conozca la voz.
   */
  deliverReply?: (text: string) => Promise<void>;
}): Promise<void> {
  const text = input.text.trim();
  if (!text) return;

  /**
   * Envio que nunca vuelve a lanzar.
   *
   * La ruta de error de este manejador tambien responde por WhatsApp: cuando el
   * fallo original era el propio transporte, ese segundo envio lanzaba otra vez
   * y la promesa terminaba rechazada sin dueno, porque quien escucha el evento
   * la descarta con `void`. El resultado era silencio absoluto y ningun rastro.
   */
  const trySend = async (message: string, stage: string): Promise<boolean> => {
    try {
      await input.waService.sendText(input.jid, message);
      return true;
    } catch (error) {
      console.error(`[WhatsApp Agent] No se pudo enviar la respuesta (${stage}) a ${input.jid}:`, error);
      return false;
    }
  };

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
        await trySend(commandResult, 'comando');
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'No pude ejecutar ese comando.';
      await trySend(`No pude completar ese comando.\n${message}`, 'error de comando');
      return;
    }
    if (WorkflowManager.isActive(sessionKey) || MeetingWorkflowManager.isActive(sessionKey)) return;
  }

  const passiveSkillReply = await tryHandlePassiveSkillRequest({
    passiveSkillsService: input.passiveSkillsService,
    senderNumber: input.senderNumber,
    text,
    isGroup: input.isGroup,
    channel: 'whatsapp',
  });
  if (passiveSkillReply) {
    await trySend(passiveSkillReply, 'skill pasiva');
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
    if (response) {
      const deliver = input.deliverReply ?? ((reply: string) => input.waService.sendText(input.jid, reply));
      try {
        await deliver(response);
      } catch (deliveryError) {
        console.error(`[WhatsApp Agent] Fallo la entrega de la respuesta a ${input.jid}:`, deliveryError);
        // La entrega inyectada puede ser por voz: si esa falla, el texto plano
        // sigue siendo una respuesta valida y es el ultimo intento util.
        await trySend(response, 'reintento en texto');
      }
    }
  } catch (err: any) {
    console.error('[WhatsApp Agent] Error:', err);
    if (!shouldResetConversationAfterAgentError(err)) {
      await trySend(getWhatsAppAgentUserErrorMessage(err), 'error del agente');
      return;
    }
    input.conversations.delete(sessionKey);
    console.warn(`[WhatsApp Agent] Auto-reset conversation for ${sessionKey} after error`);
    await trySend('Ocurrió un error. He reiniciado la conversación. Intenta de nuevo.', 'reinicio de conversacion');
  }
}
