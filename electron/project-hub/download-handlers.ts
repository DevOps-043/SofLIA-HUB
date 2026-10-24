import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { projectDownloadInput, projectUploadCancel, type ProjectDownloadResult } from '../../src/shared/project-hub-files';
import { projectHubMutationReview, projectHubReviewTarget } from './ipc-review';
import { projectHubSnapshot } from '../../src/shared/project-hub';
import type { ProjectHubApiService } from './service';
import type { ProjectFileOperations } from './file-operations';
import { createLogger } from '../utils/logger';

const log = createLogger('project-hub-descargas');
export function registerProjectHubDownloadHandlers(service: ProjectHubApiService, windows: () => (BrowserWindow | null)[],
  confirm: ReturnType<typeof nativeConfirmation>, operations: ProjectFileOperations): void {
  ipcMain.handle('project-hub:download-file', async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<ProjectDownloadResult> => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    let current: ReturnType<ProjectFileOperations['start']> = null;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (!caller.parent || !caller.userId) throw new Error('Contexto no disponible.');
      if (args.length !== 1) return { success: false, code: 'INVALID_PAYLOAD' };
      const parsed = projectDownloadInput.safeParse(projectHubSnapshot(args[0]));
      if (!parsed.success) return { success: false, code: 'INVALID_PAYLOAD' };
      current = operations.start('download', parsed.data.operationId, caller.userId, event);
      if (!current) return { success: false, code: 'DOWNLOAD_BUSY', error: 'Ya hay una operación de archivo en curso.' };
      const signal = AbortSignal.any([caller.signal, current.signal]);
      const assert = () => { caller!.assert(); if (signal.aborted) throw new Error('Descarga cancelada.'); };
      const auth = { userId: caller.userId, signal, assertCurrent: assert };
      const destination = await projectHubReviewTarget(service, parsed.data, auth); assert();
      const result = await service.downloadFile(parsed.data, { ...auth, chooseDestination: async file => {
        assert();
        if (!await confirm(caller!.parent!, projectHubMutationReview('Guardar copia local sin abrir ni sobrescribir', auth.userId,
          { archivo: file.name, tipo: file.mime, bytes: file.size, sha256: file.sha256 }, destination), assert, signal)) return null;
        assert();
        const selected = await dialog.showSaveDialog(caller!.parent!, { title: 'Guardar copia: elige un nombre nuevo', buttonLabel: 'Guardar copia',
          defaultPath: file.name, filters: [{ name: file.extension.toUpperCase(), extensions: [file.extension] }], properties: ['createDirectory'] });
        assert(); return selected.canceled ? null : selected.filePath ?? null;
      } });
      // Sólo saved/bytes y errores fijos; no ocultar una copia publicada antes de cancelar.
      log.info({ success: result.success, saved: result.data?.saved === true }, 'Descarga Project Hub terminada.');
      return result;
    } catch { return { success: false, code: 'DOWNLOAD_CANCELLED', cancelled: true, error: 'Se canceló o no se pudo preparar la descarga.' }; }
    finally { current?.release(); caller?.dispose(); }
  });
  ipcMain.handle('project-hub:cancel-download', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (args.length !== 1) return { success: false, code: 'INVALID_PAYLOAD' };
      const input = projectUploadCancel.parse(projectHubSnapshot(args[0])); operations.cancel('download', input.operationId, caller.userId, event);
      return { success: true };
    } catch { return { success: false, code: 'IPC_DENIED' }; }
    finally { caller?.dispose(); }
  });
}
