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
import {
  handleAgendaCommand,
  handleApproveWorkflowCaseCommand,
  handleComputerWorkflowCommand,
  handleDriveProjectCommand,
  handleFollowUpCommand,
  handleMailReviewCommand,
  handleMeetingPrepCommand,
  handleMeetingWorkflowCommand,
  handlePendingWorkflowCasesCommand,
  handleRejectWorkflowCaseCommand,
  handleTeamUpdateCommand,
  handleWorkflowCatalogCommand,
} from './workflow-chat-commands';

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

    case '/reuni\u00f3n':
    case '/reunion':
      return handleMeetingWorkflowCommand(toWorkflowContext(context, args));

    case '/correo':
    case '/correos':
      return handleMailReviewCommand(toWorkflowContext(context, args));

    case '/agenda':
      return handleAgendaCommand(toWorkflowContext(context, args));

    case '/seguimiento':
    case '/correoseguimiento':
      return handleFollowUpCommand(toWorkflowContext(context, args));

    case '/prepreunion':
    case '/reunionprep':
      return handleMeetingPrepCommand(toWorkflowContext(context, args));

    case '/driveproyecto':
      return handleDriveProjectCommand(toWorkflowContext(context, args));

    case '/chatdirectivo':
    case '/actualizacionchat':
      return handleTeamUpdateCommand(toWorkflowContext(context, args));

    case '/computadora':
    case '/pc':
    case '/escritorio':
      return handleComputerWorkflowCommand(toWorkflowContext(context, args));

    case '/crearflujo':
      return 'La creacion libre de flujos ya no esta habilitada por chat. Ahora guardas variantes sobre workflows predeterminados desde la app.';

    case '/flujos':
    case '/misflujos':
      return handleWorkflowCatalogCommand(context.workflowHubService);

    case '/usarflujo':
    case '/ejecutarflujo':
      return 'Los workflows ahora se ejecutan con comandos de negocio (/correo, /agenda, /seguimiento, /reunion, /driveproyecto, /chatdirectivo, /computadora) o desde variantes guardadas en la app.';

    case '/pendientes':
      return handlePendingWorkflowCasesCommand(context.workflowHubService);

    case '/aprobar':
    case '/autorizar':
      return handleApproveWorkflowCaseCommand(toWorkflowContext(context, args));

    case '/rechazar':
    case '/noautorizar':
      return handleRejectWorkflowCaseCommand(toWorkflowContext(context, args));

    case '/help':
      return buildHelpText(context.isGroup);

    default:
      return null;
  }
}

async function handleActivationCommand(context: ChatCommandContext, args: string[]): Promise<string> {
  if (!context.isGroup) return 'Este comando solo funciona en grupos.';
  if (!context.waService.isAllowedNumber(context.senderNumber)) {
    return 'Solo el administrador puede cambiar el modo de activacion.';
  }

  const mode = args[0]?.toLowerCase();
  if (mode === 'mention' || mode === 'always') {
    await context.waService.setGroupConfig({ groupActivation: mode });
    const detail = mode === 'mention'
      ? '- Solo respondere cuando me mencionen, usen /soflia, o hagan reply a mi mensaje'
      : '- Respondere a TODOS los mensajes del grupo';
    return `Activacion cambiada a: *${mode}*\n${detail}`;
  }

  return 'Uso: /activation mention | always';
}

function toWorkflowContext(context: ChatCommandContext, args: string[]) {
  return {
    senderNumber: context.senderNumber,
    args,
    workflowHubService: context.workflowHubService,
    workspaceAutomationService: context.workspaceAutomationService,
  };
}

function buildHelpText(isGroup: boolean): string {
  return `*Comandos disponibles:*\n\n/status - Estado de SofLIA\n/reset - Reiniciar conversacion\n/new - Igual que /reset\n/correo - Revisar correo\n/correo hoy - Correos de hoy\n/correo noleidos - Correos pendientes\n/agenda - Preparar agenda de hoy\n/agenda 2026-03-22 - Preparar agenda de una fecha\n/seguimiento correo@empresa.com | tema | contexto - Borrador de seguimiento\n/reunion notas... - Crear caso de reunion desde notas\n/reunion prep 2026-03-22 - Preparar reunion\n/reunion drive | LINK | titulo - Crear caso desde Drive\n/driveproyecto Nombre | carpetaPadre | espacioChat - Crear espacio en Drive\n/chatdirectivo SPACE | contexto | tono - Actualizacion ejecutiva\n/computadora describe la accion - Preparar tarea en PC\n/flujos - Ver workflows, variantes y rutinas pasivas\n/pendientes - Ver casos pendientes\n/aprobar CASE_ID - Autorizar un caso\n/rechazar CASE_ID - Rechazar un caso\n/presentacion - Proceso de presentaciones\n${isGroup ? '/activation mention|always - Modo de activacion en grupo\n' : ''}/help - Esta ayuda\n\n${isGroup ? 'En grupos, solo respondo si me etiquetas (@SofLIA), usas el prefijo /soflia, o incluyes mi nombre "soflia" en tu mensaje.' : 'Tip: tambien puedes pedir cosas como "dame mis correos a las 8 am" o "prende las luces de mi cuarto a las 9 pm" y lo guardare como workflow pasivo.'}`;
}
