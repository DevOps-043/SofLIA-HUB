type ConfirmationHandler = (toolName: string, description: string) => Promise<boolean>;
let confirmationHandler: ConfirmationHandler | null = null;

const DANGEROUS_TOOLS = new Set([
  'delete_item',
  'execute_command',
  'send_email',
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
]);

/**
 * Comandos de consulta que no modifican el sistema: no ameritan interrumpir
 * al usuario con un modal de confirmacion. Lista conservadora: cualquier
 * encadenamiento, redireccion o comando fuera de la lista sigue pidiendo
 * confirmacion.
 */
const READ_ONLY_COMMANDS = new Set([
  'dir', 'where', 'whoami', 'hostname', 'ver', 'systeminfo', 'tasklist',
  'ipconfig', 'echo', 'type', 'tree', 'findstr',
  'get-childitem', 'gci', 'ls', 'get-process', 'gps', 'get-item',
  'get-content', 'gc', 'cat', 'test-path', 'get-location', 'pwd', 'get-date',
]);

export function isReadOnlyCommand(command: string): boolean {
  const trimmed = (command || '').trim();
  if (!trimmed) return false;
  // Encadenamiento, redireccion o subexpresiones anulan la garantia de solo lectura.
  if (/[&|<>^;`]|\$\(/.test(trimmed)) return false;
  const unwrapped = trimmed
    .replace(/^cmd(\.exe)?\s+\/c\s+/i, '')
    .replace(/^powershell(\.exe)?\s+(-\w+\s+)*/i, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim();
  const firstToken = unwrapped.split(/\s+/)[0]?.toLowerCase().replace(/^["']|["']$/g, '') || '';
  return READ_ONLY_COMMANDS.has(firstToken);
}

export function setConfirmationHandler(handler: ConfirmationHandler | null) {
  confirmationHandler = handler;
}

export async function confirmToolExecution(toolName: string, args: Record<string, any>, api: Window['computerUse']): Promise<boolean> {
  if (
    (toolName === 'execute_command' || toolName === 'run_background_command')
    && isReadOnlyCommand(String(args.command || ''))
  ) {
    return true;
  }

  const needsConfirmation =
    DANGEROUS_TOOLS.has(toolName)
    || (toolName === 'organize_files' && !args.dry_run)
    || toolName === 'batch_move_files';

  if (!needsConfirmation) return true;

  const description = describeDangerousTool(toolName, args);
  if (confirmationHandler) return confirmationHandler(toolName, description);

  const result = await api!.confirmAction(description);
  return result.confirmed;
}

function describeDangerousTool(toolName: string, args: Record<string, any>): string {
  const descriptions: Record<string, string> = {
    delete_item: `Eliminar: ${args.path}`,
    organize_files: `Organizar archivos en: ${args.path}\nModo: ${args.mode || 'extension'}${args.dry_run ? '\nModo simulacion' : ''}`,
    batch_move_files: `Mover archivos de: ${args.source_directory}\nA: ${args.destination_directory}`,
    run_background_command: `Ejecutar en segundo plano: ${args.command}${args.working_directory ? `\nEn: ${args.working_directory}` : ''}`,
    kill_process_session: `Terminar sesion administrada: ${args.session_id}`,
    repair_background_host: 'Reparar el host en segundo plano de Pulse',
    configure_remote_node_host: `Configurar host remoto: ${args.bind_address || '127.0.0.1'}:${args.port || ''}`,
    register_remote_node: `Registrar nodo remoto: ${args.name} (${args.base_url})`,
    remove_remote_node: `Eliminar nodo remoto: ${args.node_id}`,
    open_application_on_node: `Abrir en nodo ${args.node_id}: ${args.path}`,
    run_background_command_on_node: `Ejecutar en nodo ${args.node_id}: ${args.command}`,
    take_screenshot_on_node: `Capturar pantalla en nodo ${args.node_id}`,
    use_computer_on_node: `Controlar nodo ${args.node_id}: ${args.task}`,
    kill_remote_node_process_session: `Terminar sesion remota ${args.session_id} en ${args.node_id}`,
    reset_browser_profile: `Resetear perfil de navegador: ${args.profile_id}`,
  };

  if (toolName === 'send_email') {
    return `Enviar email a: ${args.to}\nAsunto: ${args.subject}${args.attachment_paths?.length ? `\nAdjuntos: ${args.attachment_paths.length} archivo(s)` : ''}`;
  }

  return descriptions[toolName] || `Ejecutar comando: ${args.command}`;
}
