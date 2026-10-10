import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { executeToolDirect } from './tool-dispatch';
import { canRememberCommand, type ConfirmationOptions } from '../../src/shared/command-approval';
import { denyIfUnauthenticated } from '../main/require-auth';

type IpcMap = {
  channel: string;
  tool: string;
  args: (...params: any[]) => Record<string, any>;
};

const IPC_TOOL_MAPPINGS: IpcMap[] = [
  { channel: 'computer:list-screens', tool: 'list_screens', args: () => ({}) },
  { channel: 'computer:list-processes', tool: 'list_processes', args: () => ({}) },
  { channel: 'computer:kill-process', tool: 'kill_process', args: (pid: number) => ({ pid }) },
  { channel: 'computer:list-directory', tool: 'list_directory', args: (path: string, showHidden = false) => ({ path, show_hidden: showHidden }) },
  { channel: 'computer:read-file', tool: 'read_file', args: (path: string) => ({ path }) },
  { channel: 'computer:write-file', tool: 'write_file', args: (path: string, content: string) => ({ path, content }) },
  { channel: 'computer:create-word-document', tool: 'create_word_document', args: (options: Record<string, any>) => options || {} },
  { channel: 'computer:create-directory', tool: 'create_directory', args: (path: string) => ({ path }) },
  { channel: 'computer:move-item', tool: 'move_item', args: (source_path: string, destination_path: string) => ({ source_path, destination_path }) },
  { channel: 'computer:copy-item', tool: 'copy_item', args: (source_path: string, destination_path: string) => ({ source_path, destination_path }) },
  { channel: 'computer:delete-item', tool: 'delete_item', args: (path: string) => ({ path }) },
  { channel: 'computer:get-file-info', tool: 'get_file_info', args: (path: string) => ({ path }) },
  { channel: 'computer:search-files', tool: 'search_files', args: (directory: string, pattern: string) => ({ directory, pattern }) },
  { channel: 'computer:organize-files', tool: 'organize_files', args: (options: Record<string, any>) => options || {} },
  { channel: 'computer:batch-move-files', tool: 'batch_move_files', args: (options: Record<string, any>) => options || {} },
  { channel: 'computer:list-directory-summary', tool: 'list_directory_summary', args: (options: Record<string, any>) => options || {} },
  { channel: 'computer:undo-last-file-operation', tool: 'undo_last_file_operation', args: (options?: Record<string, any>) => options || {} },
  { channel: 'computer:execute-command', tool: 'execute_command', args: (command: string) => ({ command }) },
  { channel: 'computer:open-application', tool: 'open_application', args: (path: string) => ({ path }) },
  { channel: 'computer:open-file-on-computer', tool: 'open_file_on_computer', args: (path: string) => ({ path }) },
  { channel: 'computer:open-url', tool: 'open_url', args: (url: string) => ({ url }) },
  { channel: 'computer:run-background-command', tool: 'run_background_command', args: (args: Record<string, any>) => args || {} },
  { channel: 'computer:list-process-sessions', tool: 'list_process_sessions', args: () => ({}) },
  { channel: 'computer:poll-process-session', tool: 'poll_process_session', args: (session_id: string) => ({ session_id }) },
  { channel: 'computer:kill-process-session', tool: 'kill_process_session', args: (session_id: string) => ({ session_id }) },
  { channel: 'computer:get-system-info', tool: 'get_system_info', args: () => ({}) },
  { channel: 'computer:clipboard-read', tool: 'clipboard_read', args: () => ({}) },
  { channel: 'computer:clipboard-write', tool: 'clipboard_write', args: (text: string) => ({ text }) },
  { channel: 'computer:use-computer', tool: 'use_computer', args: (args: any) => args || {} },
  { channel: 'computer:take-screenshot', tool: 'take_screenshot', args: (display_id?: string) => ({ display_id }) },
  { channel: 'computer:get-email-config', tool: 'get_email_config', args: () => ({}) },
  { channel: 'computer:configure-email', tool: 'configure_email', args: (email: string, password: string) => ({ email, password }) },
  { channel: 'computer:send-email', tool: 'send_email', args: (to: string, subject: string, body: string, attachment_paths?: string[], is_html?: boolean) => ({ to, subject, body, attachment_paths, is_html }) },
];

export function registerComputerUseHandlers(): void {
  for (const mapping of IPC_TOOL_MAPPINGS) {
    ipcMain.handle(mapping.channel, async (event, ...params) =>
      executeToolDirect(mapping.tool, mapping.args(...params), makeProgress(event, mapping.tool)));
  }

  ipcMain.handle('computer:confirm-action', async (event, message: unknown, options?: ConfirmationOptions) => {
    if (denyIfUnauthenticated('computer:confirm-action')) return { confirmed: false };
    if (typeof message !== 'string' || !message.trim() || message.length > 8_000
      || (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options)
        || Object.keys(options).some(key => key !== 'allowAlways' && key !== 'command')
        || (options.allowAlways !== undefined && typeof options.allowAlways !== 'boolean')
        || (options.command !== undefined && (typeof options.command !== 'string' || options.command.length > 4_000))))) return { confirmed: false };
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { confirmed: false };
    const allowAlways = options?.allowAlways === true && typeof options.command === 'string'
      && canRememberCommand(options.command)
      && (message === `Ejecutar comando: ${options.command}`
        || message === `Ejecutar en segundo plano: ${options.command}`
        || message.startsWith(`Ejecutar en segundo plano: ${options.command}\nEn: `));
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancelar', 'Confirmar'],
      defaultId: 0,
      cancelId: 0,
      title: 'SofLIA — Confirmar acción',
      message: 'SofLIA quiere realizar una acción',
      detail: message,
      ...(allowAlways ? { checkboxLabel: 'Siempre permitir este comando exacto', checkboxChecked: false } : {}),
    });
    return { confirmed: result.response === 1, always: result.response === 1 && allowAlways && result.checkboxChecked === true };
  });
}

function makeProgress(event: IpcMainInvokeEvent, toolName: string) {
  return (message: string) => {
    try {
      if (!event.sender.isDestroyed()) {
        event.sender.send('computer:progress', { tool: toolName, message });
      }
    } catch {
      // Ignore renderer teardown races.
    }
  };
}
