import { normalizePhoneNumber, numbersMatch } from './phone-utils';
import type { WhatsAppAccessPermission, WhatsAppConfig } from './types';

export const WHATSAPP_ACCESS_PERMISSION_LABELS: Record<WhatsAppAccessPermission, string> = {
  files_read: 'ver archivos',
  files_write: 'modificar archivos',
  screen_view: 'ver pantalla',
  computer_control: 'controlar computadora',
  shell: 'terminal y comandos',
  clipboard: 'portapapeles',
  google_workspace: 'Google Workspace',
  messaging: 'enviar mensajes',
  system_control: 'sistema y procesos',
  automation: 'automatizaciones',
  remote_nodes: 'nodos remotos',
};

export const WHATSAPP_ACCESS_PERMISSIONS = Object.keys(
  WHATSAPP_ACCESS_PERMISSION_LABELS,
) as WhatsAppAccessPermission[];

const VALID_PERMISSION_SET = new Set<WhatsAppAccessPermission>(WHATSAPP_ACCESS_PERMISSIONS);

const TOOL_PERMISSION_MAP: Record<string, WhatsAppAccessPermission> = {
  list_directory: 'files_read',
  list_directory_summary: 'files_read',
  read_file: 'files_read',
  get_file_info: 'files_read',
  search_files: 'files_read',
  smart_find_file: 'files_read',
  semantic_file_search: 'files_read',
  save_whatsapp_file: 'files_write',
  write_file: 'files_write',
  create_directory: 'files_write',
  move_item: 'files_write',
  copy_item: 'files_write',
  delete_item: 'files_write',
  organize_files: 'files_write',
  batch_move_files: 'files_write',
  undo_last_file_operation: 'files_write',
  take_screenshot: 'screen_view',
  take_screenshot_and_send: 'screen_view',
  use_computer: 'computer_control',
  list_browser_profiles: 'computer_control',
  execute_command: 'shell',
  run_in_terminal: 'shell',
  run_background_command: 'shell',
  run_claude_code: 'shell',
  repair_background_host: 'shell',
  clipboard_read: 'clipboard',
  clipboard_write: 'clipboard',
  get_email_config: 'messaging',
  configure_email: 'messaging',
  send_email: 'messaging',
  get_system_info: 'system_control',
  get_background_host_status: 'system_control',
  set_volume: 'system_control',
  cancel_shutdown: 'system_control',
  list_processes: 'system_control',
  list_process_sessions: 'system_control',
  poll_process_session: 'system_control',
  open_application: 'system_control',
  open_file_on_computer: 'system_control',
  open_url: 'system_control',
  kill_process: 'system_control',
  lock_session: 'system_control',
  shutdown_computer: 'system_control',
  restart_computer: 'system_control',
  sleep_computer: 'system_control',
  toggle_wifi: 'system_control',
  kill_process_session: 'system_control',
  reset_browser_profile: 'system_control',
  gmail_send: 'google_workspace',
  gmail_read: 'google_workspace',
  gmail_get_messages: 'google_workspace',
  gmail_get_message: 'google_workspace',
  gmail_modify_labels: 'google_workspace',
  gmail_trash: 'google_workspace',
  gmail_preview_organization: 'google_workspace',
  gmail_apply_organization_plan: 'google_workspace',
  gmail_undo_organization_plan: 'google_workspace',
  google_calendar_create: 'google_workspace',
  google_calendar_update: 'google_workspace',
  google_calendar_delete: 'google_workspace',
  google_calendar_get_events: 'google_workspace',
  drive_search: 'google_workspace',
  drive_download: 'google_workspace',
  drive_upload: 'google_workspace',
  gchat_send_message: 'google_workspace',
  gchat_get_messages: 'google_workspace',
  gchat_get_members: 'google_workspace',
  gchat_add_reaction: 'google_workspace',
  whatsapp_send_file: 'messaging',
  whatsapp_send_to_contact: 'messaging',
  task_scheduler: 'automation',
  list_scheduled_tasks: 'automation',
  delete_scheduled_task: 'automation',
  list_active_tasks: 'automation',
  cancel_background_task: 'automation',
  neural_organizer_status: 'automation',
  neural_organizer_toggle: 'automation',
  list_dynamic_tools: 'automation',
  list_installable_toolsets: 'automation',
  list_installed_toolsets: 'automation',
  doctor_dynamic_toolsets: 'automation',
  install_dynamic_toolset: 'automation',
  uninstall_dynamic_toolset: 'automation',
  install_home_assistant_toolset: 'automation',
  configure_remote_node_host: 'remote_nodes',
  register_remote_node: 'remote_nodes',
  remove_remote_node: 'remote_nodes',
  open_application_on_node: 'remote_nodes',
  run_background_command_on_node: 'remote_nodes',
  take_screenshot_on_node: 'remote_nodes',
  use_computer_on_node: 'remote_nodes',
  kill_remote_node_process_session: 'remote_nodes',
};

export function normalizeWhatsAppMasterNumber(value: unknown): string {
  return normalizePhoneNumber(String(value || ''));
}

export function normalizeWhatsAppAccessPermissions(value: unknown): WhatsAppAccessPermission[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim() as WhatsAppAccessPermission)
        .filter((item) => VALID_PERMISSION_SET.has(item)),
    ),
  );
}

export function normalizeWhatsAppContactPermissions(
  value: unknown,
): Record<string, WhatsAppAccessPermission[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, WhatsAppAccessPermission[]> = {};
  for (const [rawNumber, rawPermissions] of Object.entries(value)) {
    const number = normalizePhoneNumber(rawNumber);
    const permissions = normalizeWhatsAppAccessPermissions(rawPermissions);
    if (number && permissions.length > 0) normalized[number] = permissions;
  }
  return normalized;
}

export function isWhatsAppMasterNumber(
  config: Pick<WhatsAppConfig, 'masterNumber'> | undefined,
  senderNumber: string,
): boolean {
  const masterNumber = normalizeWhatsAppMasterNumber(config?.masterNumber);
  return Boolean(masterNumber && numbersMatch(masterNumber, senderNumber));
}

export function getWhatsAppPermissionsForSender(
  config: Pick<WhatsAppConfig, 'masterNumber' | 'masterPermissions' | 'contactPermissions'> | undefined,
  senderNumber: string,
): WhatsAppAccessPermission[] {
  if (isWhatsAppMasterNumber(config, senderNumber)) {
    return normalizeWhatsAppAccessPermissions(
      Object.prototype.hasOwnProperty.call(config || {}, 'masterPermissions')
        ? config?.masterPermissions
        : WHATSAPP_ACCESS_PERMISSIONS,
    );
  }
  const permissions = normalizeWhatsAppContactPermissions(config?.contactPermissions);
  const matched = Object.entries(permissions).find(([number]) => numbersMatch(number, senderNumber));
  return matched ? matched[1] : [];
}

export function getRequiredPermissionForWhatsAppTool(toolName: string): WhatsAppAccessPermission | null {
  if (TOOL_PERMISSION_MAP[toolName]) return TOOL_PERMISSION_MAP[toolName];
  if (toolName.startsWith('gmail_') || toolName.startsWith('google_calendar_') || toolName.startsWith('drive_') || toolName.startsWith('gchat_')) {
    return 'google_workspace';
  }
  if (toolName.endsWith('_on_node') || toolName.includes('remote_node')) return 'remote_nodes';
  return null;
}

export function getWhatsAppToolAccessError(
  config: Pick<WhatsAppConfig, 'masterNumber' | 'masterPermissions' | 'contactPermissions'> | undefined,
  senderNumber: string,
  toolName: string,
  options: { isGroup: boolean; isGroupBlocked: boolean },
): string | null {
  const hasMasterNumber = Boolean(normalizeWhatsAppMasterNumber(config?.masterNumber));
  const isMaster = isWhatsAppMasterNumber(config, senderNumber);
  const requiredPermission = getRequiredPermissionForWhatsAppTool(toolName);

  if (options.isGroupBlocked) {
    return 'Esta herramienta no esta permitida en grupos por seguridad.';
  }

  if (!hasMasterNumber || !requiredPermission) return null;

  const granted = getWhatsAppPermissionsForSender(config, senderNumber).includes(requiredPermission);
  if (granted) return null;

  if (isMaster) {
    return `Permiso maestro requerido: ${WHATSAPP_ACCESS_PERMISSION_LABELS[requiredPermission]}. Habilitalo desde Acceso Maestro.`;
  }

  return `Permiso requerido: ${WHATSAPP_ACCESS_PERMISSION_LABELS[requiredPermission]}. Pide al numero maestro que habilite este permiso para tu numero.`;
}

export function formatWhatsAppPermissionList(permissions: WhatsAppAccessPermission[]): string {
  if (permissions.length === 0) return 'sin permisos especiales';
  return permissions.map((permission) => WHATSAPP_ACCESS_PERMISSION_LABELS[permission]).join(', ');
}

export function buildWhatsAppAccessPrompt(
  config: Pick<WhatsAppConfig, 'masterNumber' | 'masterPermissions' | 'contactPermissions'> | undefined,
  senderNumber: string,
): string {
  const hasMasterNumber = Boolean(normalizeWhatsAppMasterNumber(config?.masterNumber));
  if (!hasMasterNumber) {
    return [
      '=== PERMISOS DE WHATSAPP ===',
      'No hay numero maestro configurado. Mantienes el comportamiento actual: aplica HITL para acciones sensibles y respeta bloqueos de grupo.',
    ].join('\n');
  }

  const isMaster = isWhatsAppMasterNumber(config, senderNumber);
  const permissions = getWhatsAppPermissionsForSender(config, senderNumber);
  return [
    '=== PERMISOS DE WHATSAPP ===',
    `Numero maestro configurado: si. Remitente actual: ${isMaster ? 'numero maestro' : 'numero autorizado/no maestro'}.`,
    `Permisos especiales del remitente: ${formatWhatsAppPermissionList(permissions)}.`,
    'No intentes usar herramientas sensibles que no esten disponibles para este remitente. Si falta un permiso, explica brevemente que el numero maestro debe habilitarlo.',
  ].join('\n');
}
