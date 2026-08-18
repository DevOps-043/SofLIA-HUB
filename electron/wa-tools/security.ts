/**
 * Sets de seguridad para herramientas del agente WhatsApp.
 *
 * Tres niveles:
 *  - `BLOCKED_TOOLS_WA`: tools deshabilitadas globalmente (vacío hoy — SofLIA es omnipotente)
 *  - `CONFIRM_TOOLS_WA`: tools que requieren confirmación explícita del usuario antes de ejecutar
 *  - `GROUP_BLOCKED_TOOLS`: tools bloqueadas en chats grupales (impide que miembros del grupo
 *    controlen la máquina del host)
 */

export const BLOCKED_TOOLS_WA = new Set<string>([
  // Vacío — SofLIA puede ejecutar todo lo demás.
]);

export const CONFIRM_TOOLS_WA = new Set([
  'delete_item',
  'send_email',
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'run_in_terminal',
  'run_claude_code',
  'run_background_command',
  'kill_process_session',
  'repair_background_host',
  'configure_remote_node_host',
  'register_remote_node',
  'remove_remote_node',
  'open_application_on_node',
  'run_background_command_on_node',
  'take_screenshot_on_node',
  'use_computer_on_node',
  'kill_remote_node_process_session',
  'reset_browser_profile',
  'install_dynamic_toolset',
  'uninstall_dynamic_toolset',
  'install_home_assistant_toolset',
  'whatsapp_send_to_contact',
  'gmail_send',
  'gmail_trash',
  'gmail_apply_organization_plan',
  'gmail_undo_organization_plan',
  'google_calendar_delete',
  'gchat_send_message',
  'organize_files',
  'batch_move_files',
  'undo_last_file_operation',
]);

export const GROUP_BLOCKED_TOOLS = new Set([
  'execute_command',
  'open_application',
  'kill_process',
  'lock_session',
  'shutdown_computer',
  'restart_computer',
  'sleep_computer',
  'toggle_wifi',
  'contextual_control',
  'run_in_terminal',
  'run_claude_code',
  'run_background_command',
  'kill_process_session',
  'repair_background_host',
  'configure_remote_node_host',
  'register_remote_node',
  'remove_remote_node',
  'open_application_on_node',
  'run_background_command_on_node',
  'take_screenshot_on_node',
  'use_computer_on_node',
  'kill_remote_node_process_session',
  'reset_browser_profile',
  'install_dynamic_toolset',
  'uninstall_dynamic_toolset',
  'install_home_assistant_toolset',
  'use_computer',
  'delete_item',
  'write_file',
  'move_item',
  'clipboard_write',
  'clipboard_read',
  'organize_files',
  'batch_move_files',
  'undo_last_file_operation',
  'gmail_apply_organization_plan',
  'gmail_undo_organization_plan',
  'app_chat_list_conversations',
  'app_chat_get_context',
  'app_chat_append_note',
  'app_chat_list_assets',
  'app_chat_send_asset',
  // Una respuesta hablada queda audible para todo el grupo sin que ninguno de
  // sus miembros la haya pedido.
  'send_voice_note',
]);
