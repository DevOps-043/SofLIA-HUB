import type {
  ChannelAuthorizationResult,
  ChannelCapability,
  ChannelRole,
  ChannelScope,
  ChannelToolAuthorizationRequest,
  ResolvedChannelPrincipal,
} from './types';

export const ORG_ADMIN_ROLES: ChannelRole[] = ['owner', 'admin'];

export const ALL_CHANNEL_CAPABILITIES: ChannelCapability[] = [
  'notifications',
  'personal_agent',
  'personal_reminders',
  'own_device_control',
  'groups',
  'history',
  'broadcasts',
  'campaigns',
  'org_reminders',
  'templates',
  'approvals',
  'incidents',
  'surveys',
  'onboarding',
  'crm_intake',
  'kpi_tracking',
  'profile_flows',
  'org_policy',
  'files_read',
  'files_write',
  'screen_view',
  'computer_control',
  'shell',
  'clipboard',
  'google_workspace',
  'messaging',
  'system_control',
  'automation',
  'remote_nodes',
];

export const MEMBER_PERSONAL_CAPABILITIES: ChannelCapability[] = [
  'notifications',
  'personal_agent',
  'personal_reminders',
  'own_device_control',
  'messaging',
  'google_workspace',
  'automation',
];

const TOOL_CAPABILITY_MAP: Record<string, ChannelCapability> = {
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
  whatsapp_send_file: 'messaging',
  whatsapp_send_to_contact: 'messaging',
  send_voice_note: 'messaging',
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
  test_remote_node: 'remote_nodes',
  open_application_on_node: 'remote_nodes',
  run_background_command_on_node: 'remote_nodes',
  take_screenshot_on_node: 'remote_nodes',
  use_computer_on_node: 'remote_nodes',
  list_remote_node_process_sessions: 'remote_nodes',
  poll_remote_node_process_session: 'remote_nodes',
  kill_remote_node_process_session: 'remote_nodes',
};

const GROUP_HARD_BLOCK_CAPABILITIES = new Set<ChannelCapability>([
  'files_write',
  'screen_view',
  'computer_control',
  'shell',
  'clipboard',
  'system_control',
  'remote_nodes',
]);

export function getCapabilitiesForRole(role: ChannelRole, scope: ChannelScope): ChannelCapability[] {
  if (ORG_ADMIN_ROLES.includes(role)) return [...ALL_CHANNEL_CAPABILITIES];
  return scope === 'personal' ? [...MEMBER_PERSONAL_CAPABILITIES] : ['notifications', 'personal_agent'];
}

export function getRequiredCapabilityForTool(toolName: string): ChannelCapability | null {
  if (TOOL_CAPABILITY_MAP[toolName]) return TOOL_CAPABILITY_MAP[toolName];
  if (
    toolName.startsWith('gmail_') ||
    toolName.startsWith('google_calendar_') ||
    toolName.startsWith('drive_') ||
    toolName.startsWith('gchat_')
  ) {
    return 'google_workspace';
  }
  if (toolName.endsWith('_on_node') || toolName.includes('remote_node')) return 'remote_nodes';
  return null;
}

export function isOrgAdminRole(role: ChannelRole | undefined | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function authorizeChannelTool(
  principal: ResolvedChannelPrincipal,
  request: ChannelToolAuthorizationRequest,
): ChannelAuthorizationResult {
  const requiredCapability = getRequiredCapabilityForTool(request.toolName);

  if (!principal.active) {
    return deny(principal, requiredCapability, 'No se pudo resolver una membresia activa de SOFIA para este canal.');
  }

  if (request.isGroup && requiredCapability && GROUP_HARD_BLOCK_CAPABILITIES.has(requiredCapability)) {
    return deny(
      principal,
      requiredCapability,
      'Esta accion no se ejecuta directamente en grupos. Debe crearse una solicitud o aprobacion privada.',
    );
  }

  if (!requiredCapability) return { allowed: true, principal, requiredCapability };

  if (
    principal.scope === 'personal' &&
    principal.capabilities.includes('own_device_control') &&
    !request.isGroup &&
    (requiredCapability === 'computer_control' || requiredCapability === 'screen_view')
  ) {
    return { allowed: true, principal, requiredCapability };
  }

  if (!principal.capabilities.includes(requiredCapability)) {
    return deny(principal, requiredCapability, `Permiso requerido: ${requiredCapability}.`);
  }

  return { allowed: true, principal, requiredCapability };
}

export function authorizeHubAdminAction(
  principal: ResolvedChannelPrincipal,
  action: string,
): { allowed: boolean; reason?: string } {
  if (!principal.active) return { allowed: false, reason: 'No hay membresia activa.' };
  if (!isOrgAdminRole(principal.role)) {
    return { allowed: false, reason: `La accion "${action}" requiere rol owner o admin.` };
  }
  return { allowed: true };
}

function deny(
  principal: ResolvedChannelPrincipal,
  requiredCapability: ChannelCapability | null,
  reason: string,
): ChannelAuthorizationResult {
  return { allowed: false, principal, requiredCapability, reason };
}
