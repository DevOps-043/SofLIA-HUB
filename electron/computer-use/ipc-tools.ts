import type { z } from 'zod';
import { computerInputs } from '../../src/shared/computer-use-input';
import { COMPUTER_NATIVE_REVIEWED_TOOLS } from '../../src/shared/computer-use-policy';

export interface ComputerIpcTool { channel: string; tool: string; parse(input: unknown[]): Record<string, unknown>; review(args: Record<string, unknown>): boolean }
function define<S extends z.ZodType<unknown[]>>(channel: string, tool: string, schema: S, args: (input: z.output<S>) => Record<string, unknown>): ComputerIpcTool {
  return { channel: `computer:${channel}`, tool, parse: input => args(schema.parse(input)),
    review: input => COMPUTER_NATIVE_REVIEWED_TOOLS.has(tool) || tool === 'use_computer' && input.action !== 'screenshot' };
}
const schemas = computerInputs;
export const COMPUTER_IPC_TOOLS: readonly ComputerIpcTool[] = [
  define('list-screens', 'list_screens', schemas['list-screens'], () => ({})),
  define('list-processes', 'list_processes', schemas['list-processes'], () => ({})),
  define('kill-process', 'kill_process', schemas['kill-process'], ([pid]) => ({ pid })),
  define('list-directory', 'list_directory', schemas['list-directory'], ([path, showHidden = false]) => ({ path, show_hidden: showHidden })),
  define('read-file', 'read_file', schemas['read-file'], ([path]) => ({ path })),
  define('write-file', 'write_file', schemas['write-file'], ([path, content]) => ({ path, content })),
  define('create-word-document', 'create_word_document', schemas['create-word-document'], ([options]) => options),
  define('create-directory', 'create_directory', schemas['create-directory'], ([path]) => ({ path })),
  define('move-item', 'move_item', schemas['move-item'], ([source_path, destination_path]) => ({ source_path, destination_path })),
  define('copy-item', 'copy_item', schemas['copy-item'], ([source_path, destination_path]) => ({ source_path, destination_path })),
  define('delete-item', 'delete_item', schemas['delete-item'], ([path]) => ({ path })),
  define('get-file-info', 'get_file_info', schemas['get-file-info'], ([path]) => ({ path })),
  define('search-files', 'search_files', schemas['search-files'], ([directory, pattern]) => ({ directory, pattern })),
  define('organize-files', 'organize_files', schemas['organize-files'], ([options]) => options),
  define('batch-move-files', 'batch_move_files', schemas['batch-move-files'], ([options]) => options),
  define('list-directory-summary', 'list_directory_summary', schemas['list-directory-summary'], ([options]) => options),
  define('undo-last-file-operation', 'undo_last_file_operation', schemas['undo-last-file-operation'], ([options]) => options ?? {}),
  define('execute-command', 'execute_command', schemas['execute-command'], ([command]) => ({ command })),
  define('open-application', 'open_application', schemas['open-application'], ([path]) => ({ path })),
  define('open-file-on-computer', 'open_file_on_computer', schemas['open-file-on-computer'], ([path]) => ({ path })),
  define('open-url', 'open_url', schemas['open-url'], ([url]) => ({ url })),
  define('run-background-command', 'run_background_command', schemas['run-background-command'], ([options]) => options),
  define('list-process-sessions', 'list_process_sessions', schemas['list-process-sessions'], () => ({})),
  define('poll-process-session', 'poll_process_session', schemas['poll-process-session'], ([session_id]) => ({ session_id })),
  define('kill-process-session', 'kill_process_session', schemas['kill-process-session'], ([session_id]) => ({ session_id })),
  define('get-system-info', 'get_system_info', schemas['get-system-info'], () => ({})),
  define('clipboard-read', 'clipboard_read', schemas['clipboard-read'], () => ({})),
  define('clipboard-write', 'clipboard_write', schemas['clipboard-write'], ([text]) => ({ text })),
  define('use-computer', 'use_computer', schemas['use-computer'], ([options]) => ({ ...options, action: options.action ?? 'screenshot' })),
  define('take-screenshot', 'take_screenshot', schemas['take-screenshot'], ([display_id]) => ({ display_id })),
  define('get-email-config', 'get_email_config', schemas['get-email-config'], () => ({})),
  define('configure-email', 'configure_email', schemas['configure-email'], ([email, password]) => ({ email, password })),
  define('send-email', 'send_email', schemas['send-email'], ([to, subject, body, attachment_paths, is_html]) => ({ to, subject, body, attachment_paths, is_html })),
];
