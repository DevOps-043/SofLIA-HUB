/** Operaciones locales revisadas en main; no incluye la tarea de Desktop Agent. */
export const COMPUTER_NATIVE_REVIEWED_TOOLS: ReadonlySet<string> = new Set([
  'kill_process', 'write_file', 'create_word_document', 'create_directory',
  'move_item', 'copy_item', 'delete_item', 'organize_files', 'batch_move_files',
  'undo_last_file_operation', 'execute_command', 'open_application',
  'open_file_on_computer', 'open_url', 'run_background_command',
  'kill_process_session', 'clipboard_write', 'configure_email', 'send_email',
]);
