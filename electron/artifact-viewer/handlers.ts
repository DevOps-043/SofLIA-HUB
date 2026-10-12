import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { VIEWER_EXTENSIONS, type ArtifactReference } from '../../src/shared/artifact-viewer';
import type { ArtifactViewerService } from './service';
import { bindArtifactNavigation } from './navigation';

export const artifactReferenceSchema: z.ZodType<ArtifactReference> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('team'), jobId: z.string().uuid(), artifactId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('local'), id: z.string().uuid() }).strict(),
]);
export function registerArtifactViewerHandlers(service: ArtifactViewerService, getWindow: () => BrowserWindow | null): () => void {
  const channels: string[] = [];
  let boundWindow: BrowserWindow | null = null;
  let unbindNavigation = () => {};
  const register = <T>(name: string, schema: z.ZodType<T>, action: (input: T, window: BrowserWindow) => Promise<unknown>) => {
    channels.push(name);
    ipcMain.handle(name, async (event, payload: unknown) => {
      try {
        const window = getWindow();
        if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Superficie no autorizada.');
        const input = schema.parse(payload);
        const token = await service.guard();
        if (boundWindow !== window) { unbindNavigation(); boundWindow = window; unbindNavigation = bindArtifactNavigation(window, url => service.isHtmlPreviewUrl(url)); }
        const data = await action(input, window);
        await service.guard(token);
        return { success: true, data };
      } catch (error) {
        const message = error instanceof Error && /^(Archivo no disponible|Este formato|El archivo cambió|Selecciona el archivo|La sesión|Espera a que|No hay una aplicación|Abre la aplicación|Ya existe)/.test(error.message) ? error.message : 'No pude abrir el archivo. Comprueba que esté disponible y vuelve a intentarlo.';
        return { success: false, error: message };
      }
    });
  };
  register('artifact-viewer:preview', artifactReferenceSchema, reference => service.preview(reference));
  register('artifact-viewer:pick', z.undefined(), async (_, window) => {
    const token = await service.guard();
    const selection = await dialog.showOpenDialog(window, { title: 'Abrir archivo en PulseHub', properties: ['openFile'], filters: [{ name: 'Documentos, datos, imágenes y aplicaciones HTML', extensions: [...VIEWER_EXTENSIONS] }] });
    await service.guard(token);
    return selection.canceled || !selection.filePaths[0] ? null : service.selected(selection.filePaths[0], token);
  });
  register('artifact-viewer:open-external', artifactReferenceSchema, async reference => {
    const source = await service.resolve(reference);
    // HTML interactivo se mantiene en el sandbox: abrirlo en el navegador permitiría acceso a red.
    if (['html', 'htm'].includes(source.metadata.extension)) throw new Error('Abre la aplicación HTML en la vista previa de PulseHub.');
    const copy = await service.externalCopy(source);
    if (await shell.openPath(copy)) throw new Error('No hay una aplicación predeterminada para ese formato. Usa Guardar copia.');
    return null;
  });
  register('artifact-viewer:save-copy', artifactReferenceSchema, async (reference, window) => {
    const source = await service.resolve(reference);
    const destination = await dialog.showSaveDialog(window, { title: 'Guardar copia', defaultPath: source.metadata.name, filters: [{ name: source.metadata.extension.toUpperCase(), extensions: [source.metadata.extension] }], properties: ['createDirectory', 'showOverwriteConfirmation'] });
    await service.guard(source.token);
    if (destination.canceled || !destination.filePath) return false;
    // No sobreescribir un destino: el selector es autorización del usuario; una colisión se vuelve a elegir.
    try { await fs.writeFile(destination.filePath, source.buffer, { flag: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw Object.assign(new Error('Ya existe un archivo con ese nombre. Elige otro para guardar la copia.'), { cause: error }); throw error; }
    return true;
  });
  return () => { unbindNavigation(); channels.forEach(channel => ipcMain.removeHandler(channel)); service.clear(); };
}
