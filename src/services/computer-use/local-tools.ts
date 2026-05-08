type ComputerUseApi = NonNullable<Window['computerUse']>;

const LOCAL_TOOL_HANDLERS: Record<string, (args: Record<string, any>, api: ComputerUseApi) => Promise<any>> = {
  list_directory: (args, api) => api.listDirectory(args.path || '', args.show_hidden || false),
  read_file: (args, api) => api.readFile(args.path),
  write_file: (args, api) => api.writeFile(args.path, args.content),
  create_directory: (args, api) => api.createDirectory(args.path),
  move_item: (args, api) => api.moveItem(args.source_path, args.destination_path),
  copy_item: (args, api) => api.copyItem(args.source_path, args.destination_path),
  delete_item: (args, api) => api.deleteItem(args.path),
  get_file_info: (args, api) => api.getFileInfo(args.path),
  search_files: (args, api) => api.searchFiles(args.directory || '', args.pattern),
  organize_files: (args, api) => api.organizeFiles(args),
  batch_move_files: (args, api) => api.batchMoveFiles(args),
  list_directory_summary: (args, api) => api.listDirectorySummary(args),
  undo_last_file_operation: (args, api) => api.undoLastFileOperation(args),
  execute_command: (args, api) => api.executeCommand(args.command),
  open_application: (args, api) => api.openApplication(args.path),
  open_url: (args, api) => api.openUrl(args.url),
  get_system_info: (_args, api) => api.getSystemInfo(),
  clipboard_read: (_args, api) => api.clipboardRead(),
  clipboard_write: (args, api) => api.clipboardWrite(args.text),
  take_screenshot: (_args, api) => api.takeScreenshot(),
};

export async function executeLocalComputerTool(
  toolName: string,
  args: Record<string, any>,
  api: ComputerUseApi,
): Promise<any | null> {
  const handler = LOCAL_TOOL_HANDLERS[toolName];
  return handler ? handler(args, api) : null;
}
