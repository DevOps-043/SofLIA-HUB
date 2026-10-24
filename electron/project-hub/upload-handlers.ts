import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { projectUploadCancel, projectUploadInput, type ProjectUploadResult } from '../../src/shared/project-hub-files';
import { projectHubMutationReview, projectHubReviewTarget } from './ipc-review';
import { projectHubSnapshot } from '../../src/shared/project-hub';
import type { ProjectHubApiService } from './service';
import { createLogger } from '../utils/logger';
import type { ProjectFileOperations } from './file-operations';

const log = createLogger('project-hub-subidas');
export function registerProjectHubUploadHandlers(service: ProjectHubApiService, windows: () => (BrowserWindow | null)[],
  confirm: ReturnType<typeof nativeConfirmation>, operations: ProjectFileOperations): void {
  ipcMain.handle('project-hub:upload-files', async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<ProjectUploadResult> => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    let current: ReturnType<ProjectFileOperations['start']> = null;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (!caller.parent || !caller.userId) throw new Error('Caller inválido.');
      if (args.length !== 1) return { success: false, code: 'INVALID_PAYLOAD' };
      const parsed = projectUploadInput.safeParse(projectHubSnapshot(args[0]));
      if (!parsed.success) return { success: false, code: 'INVALID_PAYLOAD' };
      current = operations.start('upload', parsed.data.operationId, caller.userId, event);
      if (!current) return { success: false, code: 'UPLOAD_BUSY', error: 'Ya hay una operación de archivo en curso.' };
      const signal = AbortSignal.any([caller.signal, current.signal]);
      const assert = () => { caller!.assert(); if (signal.aborted) throw new Error('Subida cancelada.'); };
      const auth = { userId: caller.userId, signal, assertCurrent: assert };
      const destination = await projectHubReviewTarget(service, parsed.data, auth); assert();
      const selected = await dialog.showOpenDialog(caller.parent, { title: 'Seleccionar archivos para compartir', buttonLabel: 'Revisar selección',
        properties: ['openFile', 'multiSelections'], filters: [{ name: 'Documentos e imágenes', extensions: ['pdf', 'txt', 'md', 'csv', 'docx', 'xlsx', 'pptx', 'jpg', 'jpeg', 'png', 'gif', 'webp'] }] });
      assert();
      if (selected.canceled) return { success: false, code: 'CANCELLED', cancelled: true };
      const result = await service.uploadFiles({ workspaceId: parsed.data.workspaceId, projectId: parsed.data.projectId, paths: selected.filePaths }, {
        ...auth, approve: files => confirm(caller!.parent!, projectHubMutationReview('Subir los archivos seleccionados', auth.userId,
          { workspaceId: parsed.data.workspaceId, projectId: parsed.data.projectId, files }, destination), assert, signal),
      });
      // El servicio ya proyecta sólo contadores y errores fijos, incluso al cancelarse.
      log.info({ success: result.success, uploaded: result.data?.uploaded ?? 0, uncertain: result.uncertain === true }, 'Subida Project Hub terminada.');
      return result;
    } catch {
      return { success: false, code: 'UPLOAD_CANCELLED', cancelled: true, error: 'Se canceló o no se pudo preparar la subida.' };
    } finally { current?.release(); caller?.dispose(); }
  });
  ipcMain.handle('project-hub:cancel-upload', async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    let caller: ReturnType<typeof trustedAppCaller> | undefined;
    try {
      caller = trustedAppCaller(event, windows); caller.assert();
      if (args.length !== 1) return { success: false, code: 'INVALID_PAYLOAD' };
      const input = projectUploadCancel.parse(projectHubSnapshot(args[0]));
      operations.cancel('upload', input.operationId, caller.userId, event);
      return { success: true };
    } catch { return { success: false, code: 'IPC_DENIED' }; }
    finally { caller?.dispose(); }
  });
}
