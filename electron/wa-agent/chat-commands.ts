/**
 * Dispatcher de comandos slash del agente WhatsApp.
 *
 * Interpreta el comando y delega los casos de negocio a modulos enfocados.
 */

import type { MemoryService } from '../memory-service';
import type { WhatsAppAgent } from '../whatsapp-agent';
import type { WhatsAppService } from '../whatsapp-service';
import type { WorkspaceAutomationService } from '../workspace-automation-service';
import { WorkflowManager } from '../whatsapp-workflow-presentacion';
import { getSkillWorkspaceService } from '../skill-workspace/shared-instance';
import { PRESENTACIONES_SKILL_ID } from '../../src/shared/skills/presentaciones-skill';
import { WA_MODEL } from './constants';
import { handleActivationCommand } from './chat-commands/activation';
import { buildHelpText } from './chat-commands/help';
import { handlePermissionsCommand } from './chat-commands/permissions';
import { handleProfileCommand } from './chat-commands/profile';
import {
  buildSkillsCommandText,
  findWhatsAppSkillByCommand,
  resolveWhatsAppSkill,
} from './chat-commands/skills';
import { RETIRED_COMMAND_REPLIES } from './chat-commands/retired-commands';
import { handleVoiceCallCommand } from './chat-commands/voice-call';

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
  workspaceAutomationService: WorkspaceAutomationService | null;
  /** Usuario resuelto del remitente, para acotar por sus canales activos. */
  userId?: string | null;
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
      return `*SofLIA activa*\n- Modelo: ${WA_MODEL}\n- Modo: ${context.isGroup ? 'Grupo' : 'DM'}\n- Historial: ${context.conversations.get(sessionKey)?.length || 0} mensajes`;

    case '/reset':
    case '/new':
      context.conversations.delete(sessionKey);
      context.memory.clearSessionContext(sessionKey);
      return 'Conversacion reiniciada.';

    case '/activation':
      return handleActivationCommand(context, args);

    case '/perfil':
    case '/personalizar':
    case '/personalizacion':
      return handleProfileCommand(context, args);

    case '/permisos':
    case '/permisoswa':
      return handlePermissionsCommand(context, args);

    case '/skills':
      return await buildSkillsCommandText(context.isGroup, context.userId);

    case '/presentaci\u00f3n':
    case '/presentacion': {
      // El catalogo decide si la skill existe aqui; las guardas de WhatsApp
      // (superficie y grupo) se aplican encima, nunca al reves.
      const disponibilidad = await resolveWhatsAppSkill(PRESENTACIONES_SKILL_ID, context.isGroup, context.userId);
      if (!disponibilidad.ok) return disponibilidad.message;

      await WorkflowManager.startWorkflow(
        sessionKey,
        context.jid,
        context.senderNumber,
        context.waService,
        context.agent,
        getSkillWorkspaceService(),
      );
      return null;
    }

    case '/llamar':
    case '/llamada':
    case '/colgar':
      return handleVoiceCallCommand({
        command: cmd === '/llamada' ? '/llamar' : cmd,
        jid: context.jid,
        senderNumber: context.senderNumber,
        isGroup: context.isGroup,
        waService: context.waService,
      });

    case '/help':
      return buildHelpText(context.isGroup);

    default:
      return await handleSkillCommand(cmd, context, args);
  }
}

/**
 * Comandos que no son del dispatcher: o son una Skill del catalogo, o son uno
 * de los comandos de flujos que se retiraron.
 *
 * El orden importa. Los retirados se responden ANTES de buscar en el catalogo
 * porque algunos, como `/pendientes`, no tienen sustituto por chat y hay que
 * decir donde esta ahora esa funcion en vez de contestar "no conozco eso".
 */
async function handleSkillCommand(
  cmd: string,
  context: ChatCommandContext,
  args: string[],
): Promise<string | null> {
  const retirado = RETIRED_COMMAND_REPLIES[cmd];
  if (retirado) return retirado;

  const userId = context.userId ?? await resolveSenderUserId(context);
  const skill = await findWhatsAppSkillByCommand(cmd, context.isGroup, userId);
  if (!skill) return null;

  const disponibilidad = await resolveWhatsAppSkill(skill.id, context.isGroup, userId);
  if (!disponibilidad.ok) return disponibilidad.message;

  // La Skill aporta sus instrucciones al turno; lo que el usuario escribio tras
  // el comando es el encargo concreto. Sin encargo, se usan las instrucciones a
  // secas y la Skill decide que preguntar.
  const encargo = args.join(' ').trim();
  const prompt = [
    disponibilidad.skill.instructions,
    '',
    encargo
      ? `Peticion del usuario: ${encargo}`
      : 'El usuario invoco la skill sin dar detalles. Si necesitas una decision material para empezar, preguntala en una sola frase.',
  ].join('\n');

  return context.agent.runSkillTurn(context.jid, context.senderNumber, prompt, context.isGroup);
}

/**
 * Usuario detras del remitente, para acotar por los canales que eligio.
 *
 * Devuelve `null` cuando no hay principal resuelto, y eso NO retira ninguna
 * Skill: manda el catalogo. La autorizacion del remitente es una guarda
 * distinta, que aplica el propio canal antes de llegar hasta aqui.
 */
async function resolveSenderUserId(context: ChatCommandContext): Promise<string | null> {
  try {
    const principal = await context.agent.communicationHubService
      ?.resolvePrincipalFromWhatsApp(context.senderNumber);
    return principal?.userId ?? null;
  } catch {
    return null;
  }
}
