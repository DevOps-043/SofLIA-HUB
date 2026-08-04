import { formatForWhatsApp } from '../whatsapp-prompts';
import type { AgentLoopState } from './agent-loop-types';

const OPERATIONAL_TOOL_NAMES = new Set([
  'app_chat_list_conversations',
  'app_chat_get_context',
  'app_chat_append_note',
  'app_chat_list_assets',
  'app_chat_send_asset',
  'create_document',
  'drive_list_files',
  'drive_search',
  'drive_download',
  'drive_upload',
  'drive_create_folder',
  'get_file_info',
  'get_system_info',
  'gmail_get_messages',
  'gmail_read_message',
  'gmail_get_labels',
  'gmail_create_label',
  'gmail_delete_label',
  'gmail_apply_organization_plan',
  'gmail_batch_empty_label',
  'gmail_empty_all_labels',
  'gmail_modify_labels',
  'gmail_undo_organization_plan',
  'google_calendar_get_events',
  'google_calendar_create',
  'google_calendar_update',
  'google_calendar_delete',
  'gchat_list_spaces',
  'gchat_get_messages',
  'gchat_get_members',
  'gchat_send_message',
  'gchat_add_reaction',
  'iris_get_teams',
  'iris_get_projects',
  'iris_get_issues',
  'iris_get_my_tasks',
  'iris_get_statuses',
  'iris_get_priorities',
  'iris_get_team_members',
  'iris_create_issue',
  'iris_create_project',
  'iris_create_task',
  'iris_login',
  'iris_logout',
  'iris_update_issue',
  'iris_update_project_status',
  'iris_update_task_status',
  'neural_organizer_toggle',
  'open_file_on_computer',
  'open_url',
  'read_file',
  'save_whatsapp_file',
  'search_files',
  'semantic_file_search',
  'list_directory',
  'list_directory_summary',
  'take_screenshot_and_send',
  'task_scheduler',
  'use_computer',
  'whatsapp_send_file',
  'whatsapp_send_to_contact',
  'whatsapp_update_profile',
]);

const OPERATIONAL_TOOL_PATTERNS = [
  /^(create|write|delete|move|copy|open|run|execute|kill|lock|shutdown|restart|sleep|toggle|save|install|uninstall|repair|configure|register|remove|reset)_/,
  /^(app_chat|drive|gmail|google_calendar|gchat|iris)_/,
  /^(read_file|search_files|semantic_file_search|list_directory|list_directory_summary|get_file_info|get_system_info)$/,
  /^whatsapp_(send|update)/,
];

export async function guardUnrequestedOperationalTools(
  state: AgentLoopState,
  functionCalls: any[],
): Promise<{ done: true; text: string } | { done: false } | null> {
  if (state.options.skipConfirmations || state.isActionRequest) return null;

  const blockedTools = functionCalls
    .map((part) => String(part.functionCall?.name || ''))
    .filter((toolName) => toolName && isOperationalTool(toolName));

  if (blockedTools.length === 0) return null;

  state.loopGuardInterventions++;
  if (state.loopGuardInterventions >= 2) {
    return {
      done: true,
      text: formatForWhatsApp(
        'Te leo. Puedo seguir acompanandote, pero no voy a usar tu computadora, navegador, chats internos ni archivos si no me lo pides claramente.',
        state.isGroup,
      ),
    };
  }

  state.response = await state.chatSession.sendMessage([
    'ERROR DE INTENCION:',
    `El mensaje actual del usuario no pide ejecutar acciones. Herramientas bloqueadas: ${Array.from(new Set(blockedTools)).join(', ')}.`,
    'No uses computadora, navegador, chats internos de SofLIA, archivos, Google Workspace, IRIS ni procesos del sistema sin solicitud explicita.',
    'Si el mensaje fue saludo, sticker, reaccion o acompanamiento social, conserva la personalizacion del usuario y responde solo con texto, sin herramientas.',
  ].join('\n'));
  return { done: false };
}

function isOperationalTool(toolName: string): boolean {
  return OPERATIONAL_TOOL_NAMES.has(toolName)
    || OPERATIONAL_TOOL_PATTERNS.some((pattern) => pattern.test(toolName));
}
