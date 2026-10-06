import { canRememberCommand, isReadOnlyCommand, type ConfirmationDecision, type ConfirmationOptions } from '../../shared/command-approval';
import { getUserPreferenceScope } from '../user-scope';
import { commandApprovalKey, hasCommandApproval, rememberCommandApproval } from './command-approvals';

export { isReadOnlyCommand } from '../../shared/command-approval';
type ConfirmationHandler = (toolName: string, description: string, options?: ConfirmationOptions & { signal?: AbortSignal }) => Promise<ConfirmationDecision>;
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

const EXTERNAL_EFFECT_COMPUTER_TASK = /\b(envia\w*|enviar|send\w*|manda\w*|mandar|responde\w*|reply\w*|publica\w*|postear|post|paga\w*|pagar|compra\w*|comprar|transfiere\w*|transferir|elimina\w*|eliminar|borra\w*|borrar|delete\w*|confirmar compra|suscribe\w*|suscribir|cancelar suscripci)/;

export function setConfirmationHandler(handler: ConfirmationHandler | null) {
  confirmationHandler = handler;
}

/**
 * Pide confirmacion explicita al usuario desde cualquier herramienta, no solo
 * las de Computer Use. Sin handler ni API disponibles la respuesta es negativa:
 * una accion irreversible nunca procede por omision.
 */
export async function requestUserConfirmation(toolName: string, description: string): Promise<boolean> {
  if (confirmationHandler) return (await confirmationHandler(toolName, description)) === true;
  const api = window.computerUse;
  if (!api) return false;
  const result = await api.confirmAction(description);
  return result.confirmed;
}

export async function confirmToolExecution(toolName: string, args: Record<string, any>, api: Window['computerUse'], signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  if (
    (toolName === 'execute_command' || toolName === 'run_background_command')
    && isReadOnlyCommand(String(args.command || ''))
  ) {
    return true;
  }

  const needsConfirmation =
    DANGEROUS_TOOLS.has(toolName)
    || (toolName === 'use_computer' && hasExternalEffectComputerTask(args.task));

  if (!needsConfirmation) return true;

  const description = describeDangerousTool(toolName, args);
  const scope = getUserPreferenceScope();
  const allowAlways = (toolName === 'execute_command' || toolName === 'run_background_command')
    && canRememberCommand(String(args.command || '')) && scope !== 'sin-sesion';
  const key = allowAlways ? await commandApprovalKey(toolName, String(args.command), args.working_directory) : null;
  if (signal?.aborted || scope !== getUserPreferenceScope()) return false;
  if (allowAlways && hasCommandApproval(key)) return true;

  let decision: ConfirmationDecision;
  if (confirmationHandler) {
    decision = allowAlways || signal
      ? await confirmationHandler(toolName, description, { allowAlways, ...(signal ? { signal } : {}) })
      : await confirmationHandler(toolName, description);
  } else {
    if (!api) return false;
    const result = await api.confirmAction(description, { allowAlways, ...(allowAlways ? { command: String(args.command) } : {}) });
    decision = result.confirmed ? (result.always ? 'always' : true) : false;
  }
  if (signal?.aborted || scope !== getUserPreferenceScope()) return false;
  if (decision === 'always') {
    if (!allowAlways) return false;
    rememberCommandApproval(key);
  }
  return decision === true || decision === 'always';
}

function hasExternalEffectComputerTask(task: unknown): boolean {
  const normalized = String(task || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EXTERNAL_EFFECT_COMPUTER_TASK.test(normalized);
}

function describeDangerousTool(toolName: string, args: Record<string, any>): string {
  const descriptions: Record<string, string> = {
    delete_item: `Eliminar: ${args.path}`,
    run_background_command: `Ejecutar en segundo plano: ${args.command}${args.working_directory ? `\nEn: ${args.working_directory}` : ''}`,
    kill_process_session: `Terminar sesion administrada: ${args.session_id}`,
    repair_background_host: 'Reparar el host en segundo plano de SofLIA',
    configure_remote_node_host: `Configurar host remoto: ${args.bind_address || '127.0.0.1'}:${args.port || ''}`,
    register_remote_node: `Registrar nodo remoto: ${args.name} (${args.base_url})`,
    remove_remote_node: `Eliminar nodo remoto: ${args.node_id}`,
    open_application_on_node: `Abrir en nodo ${args.node_id}: ${args.path}`,
    run_background_command_on_node: `Ejecutar en nodo ${args.node_id}: ${args.command}`,
    take_screenshot_on_node: `Capturar pantalla en nodo ${args.node_id}`,
    use_computer_on_node: `Controlar nodo ${args.node_id}: ${args.task}`,
    kill_remote_node_process_session: `Terminar sesion remota ${args.session_id} en ${args.node_id}`,
    reset_browser_profile: `Resetear perfil de navegador: ${args.profile_id}`,
    use_computer: `Computer Use ejecutara una accion con efecto externo.\nTarea: ${String(args.task || '').slice(0, 500)}`,
  };

  if (toolName === 'send_email') {
    return `Enviar email a: ${args.to}\nAsunto: ${args.subject}${args.attachment_paths?.length ? `\nAdjuntos: ${args.attachment_paths.length} archivo(s)` : ''}`;
  }

  return descriptions[toolName] || `Ejecutar comando: ${args.command}`;
}
