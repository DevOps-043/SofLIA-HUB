import { BrowserWindow, ipcMain } from 'electron';
import { handleIPC } from './utils/ipc-helpers';
import { prepareBrandingForWorkspace } from './organization-branding/resolve-brand';
import { exportPresentationToHtml } from './skill-workspace/export-html';
import { fetchPresentationImage } from './skill-workspace/fetch-image';
import { PresentationViewController } from './skill-workspace/presentation-view';
import { buildPresentationUrl } from './skill-workspace/protocol';
import type { SkillWorkspaceService } from './skill-workspace/service';
import type { SkillWorkspacePolicyInput, SkillWorkspaceProgressEvent, SkillWorkspaceResult } from './skill-workspace/types';

/**
 * Handlers IPC del espacio de trabajo de Skills.
 *
 * Regla de gobierno: estos canales solo operan DENTRO del workspace que
 * indica el identificador; la validacion de contencion vive en el servicio y
 * no puede saltarse desde aqui. El renderer nunca recibe rutas absolutas.
 */
export function registerSkillWorkspaceHandlers(
  service: SkillWorkspaceService,
  getWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('skill-workspace:create', (_event, input: {
    skillId: string;
    title: string;
    conversationId?: string | null;
    policy: SkillWorkspacePolicyInput;
  }) => handleIPC(async () => ({ workspace: unwrap(await service.createWorkspace(input)) })));

  ipcMain.handle('skill-workspace:find-by-conversation', (_event, input: { conversationId: string }) =>
    handleIPC(async () => ({ workspace: await service.findByConversation(String(input?.conversationId ?? '')) })));

  ipcMain.handle('skill-workspace:get-state', (_event, input: { workspaceId: string }) =>
    handleIPC(async () => ({ state: unwrap(await service.getState(String(input?.workspaceId ?? ''))) })));

  ipcMain.handle('skill-workspace:read-file', (_event, input: { workspaceId: string; path: string }) =>
    handleIPC(async () => ({ content: unwrap(await service.readFile(input.workspaceId, input.path)) })));

  ipcMain.handle('skill-workspace:write-file', (_event, input: { workspaceId: string; path: string; content: string }) =>
    handleIPC(async () => ({ file: unwrap(await service.writeFile(input.workspaceId, input.path, input.content)) })));

  ipcMain.handle('skill-workspace:edit-file', (_event, input: {
    workspaceId: string;
    path: string;
    search: string;
    replace: string;
    replaceAll?: boolean;
  }) => handleIPC(async () => ({
    file: unwrap(await service.editFile(input.workspaceId, input.path, input.search, input.replace, Boolean(input.replaceAll))),
  })));

  ipcMain.handle('skill-workspace:delete-file', (_event, input: { workspaceId: string; path: string }) =>
    handleIPC(async () => ({ deleted: unwrap(await service.deleteFile(input.workspaceId, input.path)) })));

  ipcMain.handle('skill-workspace:open-folder', (_event, input: { workspaceId: string }) =>
    handleIPC(async () => ({ opened: unwrap(await service.openFolder(String(input?.workspaceId ?? ''))) })));

  ipcMain.handle('skill-workspace:delete', (_event, input: { workspaceId: string }) =>
    handleIPC(async () => ({ deleted: unwrap(await service.deleteWorkspace(String(input?.workspaceId ?? ''))) })));

  ipcMain.handle('skill-workspace:write-image', (_event, input: { workspaceId: string; fileName: string; base64: string }) =>
    handleIPC(async () => {
      const data = Buffer.from(String(input?.base64 ?? ''), 'base64');
      const file = unwrap(await service.writeImage(String(input?.workspaceId ?? ''), String(input?.fileName ?? ''), data));
      return { file };
    }));

  ipcMain.handle('skill-workspace:download-image', (_event, input: { workspaceId: string; url: string; fileName: string }) =>
    handleIPC(async () => {
      // La URL la elige el modelo: las guardas de red viven en main, nunca en
      // el renderer, para que una respuesta manipulada no pueda saltarselas.
      const descarga = await fetchPresentationImage(String(input?.url ?? ''));
      if (!descarga.ok) throw new Error(descarga.error);

      const propuesto = String(input?.fileName ?? 'imagen');
      const nombre = propuesto.includes('.') ? propuesto : `${propuesto}${descarga.extension}`;
      const file = unwrap(await service.writeImage(String(input?.workspaceId ?? ''), nombre, descarga.data));
      return { file };
    }));

  ipcMain.handle('skill-workspace:preview-url', (_event, input: { workspaceId: string; entryFile?: string }) =>
    handleIPC(async () => {
      const workspace = await service.getWorkspace(String(input?.workspaceId ?? ''));
      if (!workspace) throw new Error('El espacio de trabajo no existe o ya se cerro.');
      const entryFile = String(input?.entryFile ?? '').trim() || workspace.entryFile;
      // Solo se devuelve la URL si el documento existe: una vista previa que
      // apunta a un archivo inexistente muestra un 404 en vez de un aviso claro.
      const exists = await service.resolveAbsolutePath(workspace.id, entryFile);
      if (!exists) throw new Error('La presentacion todavia no esta lista.');
      return { url: buildPresentationUrl(workspace.id, entryFile) };
    }));

  /**
   * Exporta a un HTML autocontenido, no a PDF: imprimir aplanaria las
   * transiciones y animaciones, que son la razon de generar la presentacion
   * en HTML y no en un formato estatico.
   */
  ipcMain.handle('presentation:export-html', (_event, input: { workspaceId: string; entryFile?: string }) =>
    handleIPC(async () => {
      const result = await exportPresentationToHtml(service, String(input?.workspaceId ?? ''), input?.entryFile);
      if (!result.ok) throw new Error(result.error);
      return { htmlPath: result.htmlPath };
    }));

  /**
   * Escribe la hoja de marca ANTES de que el modelo empiece. Es el paso que
   * hace que la identidad corporativa no dependa de que el modelo copie bien
   * un color: el prompt le obliga a consumir estas variables.
   */
  ipcMain.handle('presentation:prepare-branding', (_event, input: { workspaceId: string; organizationId: string | null }) =>
    handleIPC(async () => {
      const workspaceId = String(input?.workspaceId ?? '');
      const workspaceRoot = await service.resolveWorkspaceRoot(workspaceId);
      if (!workspaceRoot) throw new Error('El espacio de trabajo no existe o ya se cerro.');

      const prepared = await prepareBrandingForWorkspace(workspaceRoot, input?.organizationId ?? null);

      const marca = await service.writeSystemFile(workspaceId, 'estilos/marca.css', prepared.css);
      if (!marca.ok) throw new Error(marca.error);
      const base = await service.writeSystemFile(workspaceId, 'estilos/base.css', prepared.baseCss);
      if (!base.ok) throw new Error(base.error);
      const guion = await service.writeSystemFile(workspaceId, 'guion-base.js', prepared.baseJs);
      if (!guion.ok) throw new Error(guion.error);

      return {
        branding: {
          enabled: prepared.branding.enabled,
          organizationName: prepared.branding.organizationName,
          colorSource: prepared.branding.colorSource,
          missingAssets: prepared.assets.missing,
          notice: prepared.notice,
        },
      };
    }));

  registerPresentationViewHandlers(getWindow);

  service.on('progreso', (event: SkillWorkspaceProgressEvent) => {
    getWindow()?.webContents.send('skill-workspace:progress', event);
  });
}

function registerPresentationViewHandlers(getWindow: () => BrowserWindow | null): void {
  const controller = new PresentationViewController(getWindow);
  controller.onClosed(() => getWindow()?.webContents.send('presentation-view:closed'));

  ipcMain.handle('presentation-view:open', (_event, input: { workspaceId: string; entryFile?: string }) =>
    handleIPC(async () => {
      const result = controller.open(String(input?.workspaceId ?? ''), input?.entryFile);
      if (!result.ok) throw new Error(result.error);
      return { opened: true };
    }));

  ipcMain.handle('presentation-view:close', () =>
    handleIPC(async () => {
      controller.close();
      return { closed: true };
    }));
}

/**
 * Convierte el resultado del servicio al patron de `handleIPC`: un fallo de
 * dominio se lanza para que viaje como `{ success: false, error }` en vez de
 * colarse como exito con datos vacios.
 */
function unwrap<T>(result: SkillWorkspaceResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
