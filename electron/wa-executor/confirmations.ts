/**
 * Construcción de mensajes de confirmación para tools peligrosos.
 *
 * Cada tool en `CONFIRM_TOOLS_WA` (ver `wa-tools/security.ts`) requiere que el
 * usuario confirme antes de ejecutarse. Aquí se genera el texto que se le
 * muestra al usuario describiendo qué se va a hacer en cada caso.
 *
 * Mantener el switch sincronizado con `CONFIRM_TOOLS_WA`: si una tool está
 * en CONFIRM_TOOLS_WA pero no aquí, cae al `default` y muestra el JSON crudo.
 */

import path from 'node:path';

export function buildConfirmationDescription(
  toolName: string,
  toolArgs: Record<string, any>,
): string {
  switch (toolName) {
    case 'delete_item':
      return `🗑️ Eliminar: ${toolArgs.path}`;
    case 'send_email':
      return `📧 Enviar email a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`;
    case 'kill_process':
      return `⚠️ Cerrar proceso: ${toolArgs.name || `PID ${toolArgs.pid}`}`;
    case 'lock_session':
      return '🔒 Bloquear sesión de Windows';
    case 'shutdown_computer':
      return `⏻ Apagar computadora (en ${toolArgs.delay_seconds || 60}s)`;
    case 'restart_computer':
      return `🔄 Reiniciar computadora (en ${toolArgs.delay_seconds || 60}s)`;
    case 'sleep_computer':
      return '😴 Suspender computadora';
    case 'toggle_wifi':
      return toolArgs.enable ? '📶 Activar Wi-Fi' : '📵 Desactivar Wi-Fi';
    case 'execute_command':
      return `💻 Ejecutar comando: ${toolArgs.command}`;
    case 'open_application':
      return `🚀 Abrir aplicación: ${toolArgs.path}`;
    case 'run_in_terminal':
      return `🖥️ Abrir terminal y ejecutar: ${toolArgs.command}${toolArgs.working_directory ? `\nEn: ${toolArgs.working_directory}` : ''}`;
    case 'run_claude_code':
      return `🤖 Lanzar Claude Code en segundo plano: "${toolArgs.task}"${toolArgs.project_directory ? `\nEn: ${toolArgs.project_directory}` : ''}`;
    case 'run_background_command':
      return `⚙️ Ejecutar en segundo plano: ${toolArgs.command}${toolArgs.working_directory ? `\nEn: ${toolArgs.working_directory}` : ''}`;
    case 'kill_process_session':
      return `🛑 Terminar sesión administrada: ${toolArgs.session_id}`;
    case 'repair_background_host':
      return '🧰 Reparar el host de segundo plano de Pulse (login item + schtasks/Startup fallback)';
    case 'install_dynamic_toolset':
      return `🧩 Instalar o actualizar toolset dinámico: ${toolArgs.toolset_id}`;
    case 'install_home_assistant_toolset':
      return '🏠 Instalar toolset dinámico de Home Assistant para controlar luces, switches, escenas y consultar estados';
    case 'whatsapp_send_to_contact':
      return `📱 Enviar a ${toolArgs.phone_number}: ${
        toolArgs.file_path
          ? path.basename(toolArgs.file_path)
          : toolArgs.message?.slice(0, 50) || 'mensaje'
      }`;
    case 'gmail_send':
      return `📧 Enviar email (Gmail) a: ${toolArgs.to}\nAsunto: ${toolArgs.subject}`;
    case 'gmail_trash':
      return `🗑️ Eliminar email: ${toolArgs.message_id}`;
    case 'gmail_apply_organization_plan':
      return `🏷️ Aplicar plan de organización de Gmail\nPlan: ${toolArgs.plan_id}${
        toolArgs.remove_from_inbox === false ? '\nMantener en INBOX' : '\nQuitando del INBOX'
      }`;
    case 'gmail_undo_organization_plan':
      return `↩️ Revertir plan de organización de Gmail${
        toolArgs.plan_id ? `\nPlan: ${toolArgs.plan_id}` : '\nUsando el último plan aplicado'
      }`;
    case 'google_calendar_delete':
      return `🗑️ Eliminar evento de Google Calendar: ${toolArgs.event_id}`;
    case 'gchat_send_message':
      return `💬 Enviar mensaje en Google Chat: ${toolArgs.text?.slice(0, 60)}`;
    case 'gchat_add_reaction':
      return `${toolArgs.emoji} Reacción en Google Chat`;
    case 'organize_files':
      return `📂 Organizar archivos en: ${toolArgs.path || 'directorio del usuario'}\nModo: ${
        toolArgs.mode || 'extension'
      }${toolArgs.dry_run ? ' (simulación)' : ''}`;
    case 'batch_move_files':
      return `📦 Mover archivos de: ${toolArgs.source_directory}\nA: ${toolArgs.destination_directory}${
        toolArgs.extensions ? `\nExtensiones: ${toolArgs.extensions.join(', ')}` : ''
      }`;
    case 'undo_last_file_operation':
      return `↩️ Deshacer operación masiva de archivos${
        toolArgs.operation_id ? `\nID: ${toolArgs.operation_id}` : '\nUsando la última operación registrada'
      }`;
    default:
      return `${toolName}: ${JSON.stringify(toolArgs)}`;
  }
}
