import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { projectCreationInputs } from '../../src/shared/project-creation';
import { PROJECT_UPLOAD_BUDGET_MS } from '../../src/shared/project-hub-files';
import { projectHubSnapshot } from '../../src/shared/project-hub';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { ProjectFileOperations } from './file-operations';
import type { ProjectLocationFilesService } from './location-files';

export function registerProjectLocationFileHandlers(service: () => ProjectLocationFilesService, windows: () => (BrowserWindow | null)[]) {
  const operations = new ProjectFileOperations();
  const confirm = nativeConfirmation('Guardar archivos del proyecto');
  ipcMain.handle('project-hub:upload-location-files', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    let current: ReturnType<ProjectFileOperations['start']> = null;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (!caller.userId || !caller.parent || args.length !== 1) throw new Error('Contexto inválido.');
      const input = projectCreationInputs.uploadLocationFiles.parse(projectHubSnapshot(args[0]));
      current = operations.start('upload', input.operationId, caller.userId, event);
      if (!current) return { success: false, error: 'Ya hay una selección de archivos en curso.' };
      const signal = AbortSignal.any([caller.signal, current.signal, AbortSignal.timeout(PROJECT_UPLOAD_BUDGET_MS)]);
      const assert = () => { caller!.assert(); if (signal.aborted) throw new Error('La operación fue cancelada.'); };
      const selected = await dialog.showOpenDialog(caller.parent, { title: 'Añadir archivos al proyecto', buttonLabel: 'Revisar archivos', properties: ['openFile', 'multiSelections'] });
      assert();
      if (selected.canceled) return { success: false, cancelled: true };
      return await service().upload(input, selected.filePaths, { userId: caller.userId, signal, assertCurrent: assert }, (files, location) => confirm(caller!.parent!, `Destino: ${location.rootPath || `${location.cloud?.provider === 'google_drive' ? 'Google Drive' : 'OneDrive'} · ${location.cloud?.accountEmail} · ${location.cloud?.name}`}\n\n${files.map(file => `${file.name} (${file.size} bytes)`).join('\n')}\n\nSe guardarán en el destino elegido. No se subirán al almacenamiento de Soflia.`, assert, signal));
    } catch { return { success: false, cancelled: true, error: 'No se pudo completar la selección. Revisa el proyecto antes de repetir.', ...(current ? { recoveryRequired: true } : {}) }; }
    finally { current?.release(); caller?.dispose(); }
  });
  ipcMain.handle('project-hub:cancel-location-upload', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (args.length !== 1) throw new Error('Payload inválido.');
      const input = projectCreationInputs.cancelLocationUpload.parse(projectHubSnapshot(args[0]));
      operations.cancel('upload', input.operationId, caller.userId, event);
      return { success: true };
    } catch { return { success: false, error: 'No se pudo cancelar esta operación.' }; }
    finally { caller?.dispose(); }
  });
}
