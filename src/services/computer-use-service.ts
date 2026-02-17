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
      getSystemInfo: () => Promise<any>;
      clipboardRead: () => Promise<any>;
      clipboardWrite: (text: string) => Promise<any>;
      takeScreenshot: () => Promise<any>;
      confirmAction: (message: string) => Promise<{ confirmed: boolean }>;
      // Email tools
      getEmailConfig: () => Promise<any>;
      configureEmail: (email: string, password: string) => Promise<any>;
      sendEmail: (to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean) => Promise<any>;
    };
  }
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

  // Confirmation for dangerous actions
  if (DANGEROUS_TOOLS.has(toolName)) {
    const desc = toolName === 'delete_item'
      ? `Eliminar: ${args.path}`
      : toolName === 'send_email'
      ? `Enviar email a: ${args.to}\nAsunto: ${args.subject}${args.attachment_paths?.length ? `\nAdjuntos: ${args.attachment_paths.length} archivo(s)` : ''}`
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

    case 'execute_command':
      result = await api.executeCommand(args.command);
      break;

    case 'open_application':
      result = await api.openApplication(args.path);
      break;

    case 'open_url':
      result = await api.openUrl(args.url);
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
