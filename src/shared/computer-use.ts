import type { ConfirmationOptions, ConfirmationResult } from './command-approval';
import type { DocumentDesignOptions } from './document-design';

/** Respuestas extensibles: sus valores deben comprobarse antes de asumir tipos. */
export type ComputerToolReply = Record<string, unknown>;
export interface CreateWordDocumentOptions {
  title?: string; subtitle?: string; author?: string; content?: string;
  file_name?: string; output_path?: string; include_cover?: boolean;
  design?: DocumentDesignOptions; open_after_save?: boolean; chart_images?: string[];
}
export interface ComputerUseApi {
  /** Main revisa cada efecto local; una aprobación renderer no concede autoridad. */
  readonly nativeActionReview?: true;
  listDirectory(dirPath: string, showHidden?: boolean): Promise<ComputerToolReply>;
  readFile(filePath: string): Promise<ComputerToolReply>;
  writeFile(filePath: string, content: string): Promise<ComputerToolReply>;
  createWordDocument(options: CreateWordDocumentOptions): Promise<ComputerToolReply>;
  createDirectory(dirPath: string): Promise<ComputerToolReply>;
  moveItem(source: string, dest: string): Promise<ComputerToolReply>;
  copyItem(source: string, dest: string): Promise<ComputerToolReply>;
  deleteItem(itemPath: string): Promise<ComputerToolReply>;
  getFileInfo(filePath: string): Promise<ComputerToolReply>;
  searchFiles(dirPath: string, pattern: string): Promise<ComputerToolReply>;
  executeCommand(command: string): Promise<ComputerToolReply>;
  openApplication(target: string): Promise<ComputerToolReply>;
  openUrl(url: string): Promise<ComputerToolReply>;
  runBackgroundCommand(options: Record<string, unknown>): Promise<ComputerToolReply>;
  listProcessSessions(): Promise<ComputerToolReply>;
  pollProcessSession(sessionId: string): Promise<ComputerToolReply>;
  killProcessSession(sessionId: string): Promise<ComputerToolReply>;
  getSystemInfo(): Promise<ComputerToolReply>;
  clipboardRead(): Promise<ComputerToolReply>;
  clipboardWrite(text: string): Promise<ComputerToolReply>;
  takeScreenshot(): Promise<ComputerToolReply>;
  confirmAction(message: string, options?: ConfirmationOptions): Promise<ConfirmationResult>;
  organizeFiles(options: Record<string, unknown>): Promise<ComputerToolReply>;
  batchMoveFiles(options: Record<string, unknown>): Promise<ComputerToolReply>;
  listDirectorySummary(options: Record<string, unknown>): Promise<ComputerToolReply>;
  undoLastFileOperation(options?: Record<string, unknown>): Promise<ComputerToolReply>;
  getEmailConfig(): Promise<ComputerToolReply>;
  configureEmail(email: string, password: string): Promise<ComputerToolReply>;
  sendEmail(to: string, subject: string, body: string, attachmentPaths?: string[], isHtml?: boolean): Promise<ComputerToolReply>;
  getSidebarPosition?(): Promise<'left' | 'right' | 'bottom'>;
  setSidebarPosition?(position: 'left' | 'right' | 'bottom'): Promise<boolean>;
  getTheme?(): Promise<'system' | 'light' | 'dark'>;
  setTheme?(theme: 'system' | 'light' | 'dark'): Promise<boolean>;
}
