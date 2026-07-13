import { ipcMain } from 'electron';
import type { PrivacyConfig, PythonToolsService } from './python-tools-service';
import { handleIPC } from './utils/ipc-helpers';

/** IPC del sidecar de herramientas (documentos + privacidad). */
export function registerPythonToolsHandlers(pythonToolsService: PythonToolsService): void {
  ipcMain.handle('pytools:status', () =>
    handleIPC(async () => ({ status: pythonToolsService.getStatus() })));

  ipcMain.handle('pytools:parse-document', (_event, filePath: string) =>
    handleIPC(async () => {
      const result = await pythonToolsService.parseDocument(String(filePath || '').trim());
      if (!result.success) throw new Error(result.error.message);
      return { document: result.data };
    }));

  ipcMain.handle('pytools:redact-text', (_event, text: string) =>
    handleIPC(async () => {
      const result = await pythonToolsService.redactText(String(text || ''));
      if (!result.success) throw new Error(result.error.message);
      return { redaction: result.data };
    }));

  ipcMain.handle('pytools:get-privacy-config', () =>
    handleIPC(async () => ({ config: pythonToolsService.getPrivacyConfig() })));

  ipcMain.handle('pytools:set-privacy-config', (_event, updates: Partial<PrivacyConfig>) =>
    handleIPC(async () => {
      const patch: Partial<PrivacyConfig> = {};
      if (typeof updates?.redactDocuments === 'boolean') patch.redactDocuments = updates.redactDocuments;
      return { config: pythonToolsService.setPrivacyConfig(patch) };
    }));

  console.log('[PythonToolsHandlers] Registered successfully');
}
