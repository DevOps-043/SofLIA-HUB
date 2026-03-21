/**
 * Computer Use Service — Renderer-side bridge to Electron main process.
 * Executes real OS operations via IPC and formats results for the AI.
 */

// Type-safe window augmentation
declare global {
  interface Window {
    computerUse?: {
      listDirectory: (dirPath: string, showHidden?: boolean) => Promise<any>;
      readFile: (filePath: string) => Promise<any>;
      writeFile: (filePath: string, content: string) => Promise<any>;
      createDirectory: (dirPath: string) => Promise<any>;
      moveItem: (source: string, dest: string) => Promise<any>;
      copyItem: (source: string, dest: string) => Promise<any>;
      deleteItem: (itemPath: string) => Promise<any>;
      getFileInfo: (filePath: string) => Promise<any>;
      searchFiles: (dirPath: string, pattern: string) => Promise<any>;
      executeCommand: (command: string) => Promise<any>;
      openApplication: (target: string) => Promise<any>;
      openUrl: (url: string) => Promise<any>;
      runBackgroundCommand: (options: any) => Promise<any>;
      listProcessSessions: () => Promise<any>;
      pollProcessSession: (sessionId: string) => Promise<any>;
      killProcessSession: (sessionId: string) => Promise<any>;
      getSystemInfo: () => Promise<any>;
      clipboardRead: () => Promise<any>;
      clipboardWrite: (text: string) => Promise<any>;
      takeScreenshot: () => Promise<any>;
      confirmAction: (message: string) => Promise<{ confirmed: boolean }>;
      organizeFiles: (options: any) => Promise<any>;
      batchMoveFiles: (options: any) => Promise<any>;
      listDirectorySummary: (options: any) => Promise<any>;
      undoLastFileOperation: (options?: any) => Promise<any>;
      // Email tools
      getEmailConfig: () => Promise<any>;
      configureEmail: (email: string, password: string) => Promise<any>;
      sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) => Promise<any>;
    };
    desktopAgent?: {
      executeTask: (task: string, options?: any) => Promise<any>;
      executeParallel: (tasks: Array<{ task: string; maxSteps?: number; backend?: 'auto' | 'browser' | 'desktop' | 'uia'; startUrl?: string }>) => Promise<any>;
      getActiveTasks: () => Promise<any>;
      abortTask: (taskId: string) => Promise<any>;
      abort: () => Promise<any>;
      getStatus: () => Promise<any>;
      getConfig: () => Promise<any>;
      listBrowserProfiles: () => Promise<any>;
      resetBrowserProfile: (profileId: string) => Promise<any>;
      setConfig: (updates: any) => Promise<any>;
      startObservation: (objective: string, rules?: string) => Promise<any>;
      stopObservation: () => Promise<any>;
      click: (x: number, y: number) => Promise<any>;
      doubleClick: (x: number, y: number) => Promise<any>;
      rightClick: (x: number, y: number) => Promise<any>;
      drag: (x1: number, y1: number, x2: number, y2: number) => Promise<any>;
      type: (text: string) => Promise<any>;
      key: (key: string) => Promise<any>;
      scroll: (direction: string, amount?: number) => Promise<any>;
      focusWindow: (title: string) => Promise<any>;
      listWindows: () => Promise<any>;
      takeScreenshot: (fullRes?: boolean) => Promise<any>;
    };
    remoteNode?: {
      getHostStatus: () => Promise<any>;
      updateHostConfig: (updates: any) => Promise<any>;
      listNodes: () => Promise<any>;
      registerNode: (node: any) => Promise<any>;
      removeNode: (nodeId: string) => Promise<any>;
      testNode: (nodeId: string) => Promise<any>;
      openApplication: (nodeId: string, args: any) => Promise<any>;
      runBackgroundCommand: (nodeId: string, args: any) => Promise<any>;
      executeTask: (nodeId: string, args: any) => Promise<any>;
      listProcessSessions: (nodeId: string) => Promise<any>;
      pollProcessSession: (nodeId: string, sessionId: string) => Promise<any>;
      killProcessSession: (nodeId: string, sessionId: string) => Promise<any>;
    };
  }
}

export function isDesktopAgentAvailable(): boolean {
  return !!window.desktopAgent;
}

export function getDesktopAgentAPI() {
  if (!window.desktopAgent) {
    throw new Error('Desktop Agent API no disponible.');
  }
  return window.desktopAgent;
}

function getAPI() {
  if (!window.computerUse) {
    throw new Error('Computer Use API no disponible. Asegúrate de ejecutar en Electron.');
  }
  return window.computerUse;
}

// Actions that require user confirmation before execution
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
  'use_computer_on_node',
  'kill_remote_node_process_session',
  'reset_browser_profile',
]);

// Callback-based confirmation system — allows React UI to handle confirmations
type ConfirmationHandler = (toolName: string, description: string) => Promise<boolean>;
let _confirmationHandler: ConfirmationHandler | null = null;

/**
 * Register a custom confirmation handler (called from React components).
 * The handler receives the tool name and a description, returns true to proceed.
 */
export function setConfirmationHandler(handler: ConfirmationHandler | null) {
  _confirmationHandler = handler;
}

/**
 * Execute a computer use tool by name with given arguments.
 * Returns a string result formatted for the AI to understand.
 */
export async function executeComputerTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const api = getAPI();
  const desktopApi = toolName === 'use_computer' ? getDesktopAgentAPI() : null;

  // Confirmation for dangerous actions
  const needsConfirmation =
    DANGEROUS_TOOLS.has(toolName)
    || (toolName === 'organize_files' && !args.dry_run)
    || toolName === 'batch_move_files';

  if (needsConfirmation) {
    const desc = toolName === 'delete_item'
      ? `Eliminar: ${args.path}`
      : toolName === 'send_email'
      ? `Enviar email a: ${args.to}\nAsunto: ${args.subject}${args.attachment_paths?.length ? `\nAdjuntos: ${args.attachment_paths.length} archivo(s)` : ''}`
      : toolName === 'organize_files'
      ? `Organizar archivos en: ${args.path}\nModo: ${args.mode || 'extension'}${args.dry_run ? '\nModo simulacion' : ''}`
      : toolName === 'batch_move_files'
      ? `Mover archivos de: ${args.source_directory}\nA: ${args.destination_directory}`
      : toolName === 'run_background_command'
      ? `Ejecutar en segundo plano: ${args.command}${args.working_directory ? `\nEn: ${args.working_directory}` : ''}`
      : toolName === 'kill_process_session'
      ? `Terminar sesion administrada: ${args.session_id}`
      : toolName === 'repair_background_host'
      ? 'Reparar el host en segundo plano de SofLIA'
      : toolName === 'configure_remote_node_host'
      ? `Configurar host remoto: ${args.bind_address || '127.0.0.1'}:${args.port || ''}`
      : toolName === 'register_remote_node'
      ? `Registrar nodo remoto: ${args.name} (${args.base_url})`
      : toolName === 'remove_remote_node'
      ? `Eliminar nodo remoto: ${args.node_id}`
      : toolName === 'open_application_on_node'
      ? `Abrir en nodo ${args.node_id}: ${args.path}`
      : toolName === 'run_background_command_on_node'
      ? `Ejecutar en nodo ${args.node_id}: ${args.command}`
      : toolName === 'use_computer_on_node'
      ? `Controlar nodo ${args.node_id}: ${args.task}`
      : toolName === 'kill_remote_node_process_session'
      ? `Terminar sesion remota ${args.session_id} en ${args.node_id}`
      : toolName === 'reset_browser_profile'
      ? `Resetear perfil de navegador: ${args.profile_id}`
      : `Ejecutar comando: ${args.command}`;

    let confirmed = false;
    if (_confirmationHandler) {
      // Use the React-based modal
      confirmed = await _confirmationHandler(toolName, desc);
    } else {
      // Fallback to native Electron dialog
      const result = await api.confirmAction(desc);
      confirmed = result.confirmed;
    }

    if (!confirmed) {
      return JSON.stringify({ success: false, error: 'Acción cancelada por el usuario.' });
    }
  }

  let result: any;

  switch (toolName) {
    case 'list_directory':
      result = await api.listDirectory(args.path || '', args.show_hidden || false);
      break;

    case 'read_file':
      result = await api.readFile(args.path);
      break;

    case 'write_file':
      result = await api.writeFile(args.path, args.content);
      break;

    case 'create_directory':
      result = await api.createDirectory(args.path);
      break;

    case 'move_item':
      result = await api.moveItem(args.source_path, args.destination_path);
      break;

    case 'copy_item':
      result = await api.copyItem(args.source_path, args.destination_path);
      break;

    case 'delete_item':
      result = await api.deleteItem(args.path);
      break;

    case 'get_file_info':
      result = await api.getFileInfo(args.path);
      break;

    case 'search_files':
      result = await api.searchFiles(args.directory || '', args.pattern);
      break;

    case 'organize_files':
      result = await api.organizeFiles(args);
      break;

    case 'batch_move_files':
      result = await api.batchMoveFiles(args);
      break;

    case 'list_directory_summary':
      result = await api.listDirectorySummary(args);
      break;

    case 'undo_last_file_operation':
      result = await api.undoLastFileOperation(args);
      break;

    case 'execute_command':
      result = await api.executeCommand(args.command);
      break;

    case 'open_application':
      result = await api.openApplication(args.path);
      break;

    case 'open_url':
      result = await api.openUrl(args.url);
      break;

    case 'run_background_command':
      result = await api.runBackgroundCommand(args);
      break;

    case 'list_process_sessions':
      result = await api.listProcessSessions();
      break;

    case 'poll_process_session':
      result = await api.pollProcessSession(args.session_id);
      break;

    case 'kill_process_session':
      result = await api.killProcessSession(args.session_id);
      break;

    case 'get_background_host_status':
      if (!window.backgroundHost) throw new Error('Background Host API no disponible.');
      result = await window.backgroundHost.getStatus();
      break;

    case 'repair_background_host':
      if (!window.backgroundHost) throw new Error('Background Host API no disponible.');
      result = await window.backgroundHost.repair();
      break;

    case 'get_system_info':
      result = await api.getSystemInfo();
      break;

    case 'clipboard_read':
      result = await api.clipboardRead();
      break;

    case 'clipboard_write':
      result = await api.clipboardWrite(args.text);
      break;

    case 'take_screenshot':
      result = await api.takeScreenshot();
      break;

    case 'use_computer':
      result = await desktopApi!.executeTask(args.task, {
        maxSteps: args.max_steps,
        backend: args.backend,
        startUrl: args.start_url,
        browserProfile: args.browser_profile,
        browserIsolated: args.browser_isolated,
        resetBrowserProfile: args.reset_browser_profile,
      });
      if (typeof result === 'string') {
        result = { success: true, message: result };
      }
      break;

    case 'list_browser_profiles':
      result = await desktopApi!.listBrowserProfiles();
      break;

    case 'reset_browser_profile':
      result = await desktopApi!.resetBrowserProfile(args.profile_id);
      break;

    case 'get_remote_node_host_status':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.getHostStatus();
      break;

    case 'configure_remote_node_host':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.updateHostConfig(args);
      break;

    case 'list_remote_nodes':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.listNodes();
      break;

    case 'register_remote_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.registerNode({
        id: args.node_id,
        name: args.name,
        base_url: args.base_url,
        token: args.token,
        enabled: args.enabled,
      });
      break;

    case 'remove_remote_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.removeNode(args.node_id);
      break;

    case 'test_remote_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.testNode(args.node_id);
      break;

    case 'open_application_on_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.openApplication(args.node_id, { path: args.path });
      break;

    case 'run_background_command_on_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.runBackgroundCommand(args.node_id, args);
      break;

    case 'use_computer_on_node':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.executeTask(args.node_id, args);
      break;

    case 'list_remote_node_process_sessions':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.listProcessSessions(args.node_id);
      break;

    case 'poll_remote_node_process_session':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.pollProcessSession(args.node_id, args.session_id);
      break;

    case 'kill_remote_node_process_session':
      if (!window.remoteNode) throw new Error('Remote Node API no disponible.');
      result = await window.remoteNode.killProcessSession(args.node_id, args.session_id);
      break;

    case 'get_email_config':
      result = await api.getEmailConfig();
      break;

    case 'configure_email':
      result = await api.configureEmail(args.email, args.password);
      break;

    case 'send_email':
      result = await api.sendEmail(args.to, args.subject, args.body, args.attachment_paths, args.is_html);
      break;

    default:
      result = { success: false, error: `Herramienta desconocida: ${toolName}` };
  }

  return JSON.stringify(result);
}

/**
 * Check if Computer Use API is available (running in Electron).
 */
export function isComputerUseAvailable(): boolean {
  return !!window.computerUse;
}
