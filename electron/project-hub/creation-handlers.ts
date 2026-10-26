import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { projectCreationInputs } from '../../src/shared/project-creation';
import { projectHubSnapshot } from '../../src/shared/project-hub';
import { nativeConfirmation, trustedAppCaller } from '../ipc/caller-authorization';
import { ProjectCreationService } from './project-creation';
import { ProjectLocationStore } from './location-store';
import { resolveProjectOrganization } from './organization';
import type { ProjectHubApiService } from './service';
import type { ProjectHubOperationAuthorization } from './session-context';
import type { CalendarService } from '../calendar-service';
import { createProjectCloudStorage } from './cloud-storage';
import { ProjectLocationFilesService } from './location-files';
import { registerProjectLocationFileHandlers } from './location-file-handlers';

export function registerProjectCreationHandlers(service: ProjectHubApiService, windows: () => (BrowserWindow | null)[], calendar?: CalendarService) {
  const resolve = (id: string, auth: ProjectHubOperationAuthorization) => resolveProjectOrganization(service, id, auth);
  // Carga diferida: registrar IPC no abre archivos ni depende de app.ready.
  let creation: ProjectCreationService | undefined;
  let store: ProjectLocationStore | undefined;
  const locationStore = () => store ??= new ProjectLocationStore(path.join(app.getPath('userData'), 'project-locations'));
  let providers: ReturnType<typeof createProjectCloudStorage> | undefined;
  const connections = () => providers ??= createProjectCloudStorage(calendar, locationStore());
  const storage = () => creation ??= new ProjectCreationService({
    service, resolveOrganization: resolve, defaultDirectory: app.getPath('documents'),
    store: locationStore(), cloud: connections().storage,
  });
  let files: ProjectLocationFilesService | undefined;
  const locationFiles = () => files ??= new ProjectLocationFilesService(storage(), locationStore(), connections().storage, service);
  let selectingFolder = false;
  const register = <T>(channel: string, schema: z.ZodType<T>, operation: (input: T, auth: ProjectHubOperationAuthorization, parent: BrowserWindow) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      let caller: ReturnType<typeof trustedAppCaller> | undefined;
      try {
        caller = trustedAppCaller(event, windows); caller.assert();
        if (!caller.userId || !caller.parent) throw new Error('Sin sesión.');
        if (args.length !== 1) return { success: false, code: 'INVALID_PAYLOAD', error: 'Solicitud de proyecto inválida.' };
        const parsed = schema.safeParse(projectHubSnapshot(args[0]));
        if (!parsed.success) return { success: false, code: 'INVALID_PAYLOAD', error: 'Revisa los datos del proyecto.' };
        const result = await operation(parsed.data, { userId: caller.userId, assertCurrent: caller.assert, signal: caller.signal }, caller.parent);
        caller.assert();
        return result;
      } catch {
        return { success: false, code: 'CREATION_UNAVAILABLE', error: channel === 'project-hub:resolve-organization' ? 'No se pudo comprobar la sesión del proyecto. Actualiza la conexión y vuelve a intentarlo.' : channel === 'project-hub:preview-location-file' ? 'Este archivo no tiene vista previa disponible. Se admiten PDF, imágenes y texto de hasta 8 MB en la carpeta del proyecto.' : 'No se pudo acceder a la cuenta o carpeta. Revisa la conexión y los permisos de archivos.', ...(['project-hub:create-configured', 'project-hub:link-cloud-file'].includes(channel) ? { uncertain: true, recoveryRequired: true } : {}) };
      } finally { caller?.dispose(); }
    });
  };
  register('project-hub:resolve-organization', projectCreationInputs.resolveOrganization, async (input, auth) => ({ success: true, data: await resolve(input.organizationId, auth) }));
  register('project-hub:select-folder', projectCreationInputs.selectFolder, async (_input, auth, parent) => {
    if (selectingFolder) return { success: false, error: 'Ya hay un selector de carpetas abierto.' };
    selectingFolder = true;
    try {
      const selected = await dialog.showOpenDialog(parent, { title: 'Elegir carpeta del proyecto', buttonLabel: 'Usar esta carpeta', defaultPath: app.getPath('documents'), properties: ['openDirectory', 'createDirectory'] });
      auth.assertCurrent();
      if (selected.canceled || !selected.filePaths[0]) return { success: false, cancelled: true };
      return { success: true, data: await storage().selectFolder(selected.filePaths[0], auth) };
    } finally { selectingFolder = false; }
  });
  register('project-hub:cloud-accounts', projectCreationInputs.cloudAccounts, async (_input, auth) => ({ success: true, data: await connections().accounts(auth) }));
  register('project-hub:authorize-cloud', projectCreationInputs.authorizeCloud, async (input, auth, parent) => ({ success: await connections().authorize(input.provider, auth, parent) }));
  register('project-hub:cloud-folders', projectCreationInputs.cloudFolders, async (input, auth) => ({ success: true, data: await connections().storage.folders(input, auth) }));
  register('project-hub:cloud-files', projectCreationInputs.cloudFiles, async (input, auth) => ({ success: true, data: await connections().storage.folders(input, auth, true) }));
  register('project-hub:link-cloud-file', projectCreationInputs.linkCloudFile, async (input, auth, parent) => {
    const project = await service.getProject(input, auth); auth.assertCurrent();
    if (!project.success) return project;
    const file = await connections().storage.selectedFile(input.selectionId, auth);
    if (!await nativeConfirmation('Vincular archivo de Drive')(parent, `Se vinculará «${file.name}» al proyecto seleccionado.\nEl original permanece en Google Drive y conserva sus permisos.`, auth.assertCurrent, auth.signal)) return { success: false, cancelled: true };
    const current = await connections().storage.selectedFile(input.selectionId, auth);
    const mime = current.mimeType || '';
    return service.createDocument({ workspaceId: input.workspaceId, projectId: input.projectId, document: { name: current.name.slice(0, 255), provider: 'google_drive', external_id: current.id, external_url: `https://drive.google.com/file/d/${encodeURIComponent(current.id)}/view`, doc_type: mime.includes('spreadsheet') ? 'spreadsheet' : mime.includes('presentation') ? 'presentation' : 'document' } }, auth);
  });
  register('project-hub:create-cloud-folder', projectCreationInputs.createCloudFolder, async (input, auth) => ({ success: true, data: await connections().storage.createFolder(input, auth) }));
  register('project-hub:create-configured', projectCreationInputs.createConfigured, (input, auth) => storage().create(input, auth));
  register('project-hub:get-location', projectCreationInputs.getLocation, async (input, auth) => ({ success: true, data: await storage().location(input, auth) }));
  register('project-hub:location-files', projectCreationInputs.locationFiles, async (input, auth) => ({ success: true, data: await locationFiles().list(input, auth) }));
  register('project-hub:preview-location-file', projectCreationInputs.previewLocationFile, async (input, auth) => ({ success: true, data: await locationFiles().preview(input, auth) }));
  registerProjectLocationFileHandlers(locationFiles, windows);
}
