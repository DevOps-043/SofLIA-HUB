/**
 * Dispatcher de comandos slash del agente WhatsApp.
 *
 * Interpreta el comando y delega los casos de negocio a modulos enfocados.
 */

import type { MemoryService } from '../memory-service';
import type { WhatsAppAgent } from '../whatsapp-agent';
import type { WhatsAppService } from '../whatsapp-service';
import type { WorkflowHubService } from '../workflow-hub-service';
import type { WorkspaceAutomationService } from '../workspace-automation-service';
import { WorkflowManager } from '../whatsapp-workflow-presentacion';
import { handleActivationCommand } from './chat-commands/activation';
import { buildHelpText } from './chat-commands/help';
import { handleWorkflowBusinessCommand } from './chat-commands/workflow-router';

type ConversationHistory = Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>;

export interface ChatCommandContext {
  jid: string;
  senderNumber: string;
  text: string;
  isGroup: boolean;
  agent: WhatsAppAgent;
  conversations: ConversationHistory;
  memory: Pick<MemoryService, 'clearSessionContext'>;
  waService: WhatsAppService;
  workflowHubService: WorkflowHubService | null;
  workspaceAutomationService: WorkspaceAutomationService | null;
}

export async function handleChatCommand(context: ChatCommandContext): Promise<string | null> {
  const parts = context.text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  const sessionKey = context.isGroup
    ? `group:${context.jid}:${context.senderNumber}`
    : context.senderNumber;

  switch (cmd) {
    case '/status':
      return `*SofLIA activa*\n- Modelo: Gemini 2.5 Flash\n- Modo: ${context.isGroup ? 'Grupo' : 'DM'}\n- Historial: ${context.conversations.get(sessionKey)?.length || 0} mensajes`;

    case '/reset':
    case '/new':
      context.conversations.delete(sessionKey);
      context.memory.clearSessionContext(sessionKey);
      return 'Conversacion reiniciada.';

    case '/activation':
      return handleActivationCommand(context, args);

    case '/presentaci\u00f3n':
    case '/presentacion':
      await WorkflowManager.startWorkflow(
        sessionKey,
        context.jid,
        context.senderNumber,
        context.waService,
        context.agent,
      );
      return null;

    case '/help':
      return buildHelpText(context.isGroup);

    default:
      return (await handleWorkflowBusinessCommand(cmd, context, args)) ?? null;
  }
}
