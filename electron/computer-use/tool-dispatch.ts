import { organizeFiles, batchMoveFiles, listDirectorySummary, undoLastFileOperation } from './batch-file-ops';
import {
  handleCopyItem,
  handleCreateDirectory,
  handleDeleteItem,
  handleGetFileInfo,
  handleListDirectory,
  handleMoveItem,
  handleReadFile,
  handleSearchFiles,
  handleWriteFile,
} from './filesystem-handlers';
import { handleExecuteCommand } from './command-tool';
import { handleOpenPath, handleOpenUrl } from './app-open-tool';
import { handleRunBackgroundCommand, handleListProcessSessions, handlePollProcessSession, handleKillProcessSession } from './background-process-tools';
import { handleClipboardRead, handleClipboardWrite } from './clipboard-tools';
import { handleConfigureEmail, handleGetEmailConfig, handleSendEmail } from './email-tools';
import { handleUseComputer } from './gui-tool';
import { handleListScreens, handleTakeScreenshot } from './screenshot-tool';
import { handleGetSystemInfo, handleKillProcess, handleListProcesses } from './process-system-tools';

export async function executeToolDirect(
  toolName: string,
  args: Record<string, any>,
  onProgress?: (message: string) => void,
): Promise<any> {
  switch (toolName) {
    case 'list_screens': return handleListScreens();
    case 'list_processes': return handleListProcesses();
    case 'kill_process': return handleKillProcess(Number(args.pid));
    case 'list_directory': return handleListDirectory(args, onProgress);
    case 'read_file': return handleReadFile(args);
    case 'write_file': return handleWriteFile(args, onProgress);
    case 'create_directory': return handleCreateDirectory(args);
    case 'move_item': return handleMoveItem(args, onProgress);
    case 'copy_item': return handleCopyItem(args, onProgress);
    case 'delete_item': return handleDeleteItem(args, onProgress);
    case 'get_file_info': return handleGetFileInfo(args);
    case 'search_files': return handleSearchFiles(args, onProgress);
    case 'organize_files': return organizeFiles(args, onProgress);
    case 'batch_move_files': return batchMoveFiles(args, onProgress);
    case 'list_directory_summary': return listDirectorySummary(args, onProgress);
    case 'undo_last_file_operation': return undoLastFileOperation(args, onProgress);
    case 'execute_command': return handleExecuteCommand(args, onProgress);
    case 'open_file_on_computer':
    case 'open_application': return handleOpenPath(toolName, args, onProgress);
    case 'open_url': return handleOpenUrl(args.url);
    case 'run_background_command': return handleRunBackgroundCommand(args);
    case 'list_process_sessions': return handleListProcessSessions();
    case 'poll_process_session': return handlePollProcessSession(args);
    case 'kill_process_session': return handleKillProcessSession(args);
    case 'get_system_info': return handleGetSystemInfo();
    case 'clipboard_read': return handleClipboardRead();
    case 'clipboard_write': return handleClipboardWrite(args);
    case 'use_computer': return handleUseComputer(args, onProgress);
    case 'take_screenshot': return handleTakeScreenshot(args, onProgress);
    case 'get_email_config': return handleGetEmailConfig();
    case 'configure_email': return handleConfigureEmail(args);
    case 'send_email': return handleSendEmail(args, onProgress);
    default: return { success: false, error: `Herramienta desconocida: ${toolName}` };
  }
}
