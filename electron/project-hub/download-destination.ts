import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProjectHubError } from './session-contract';
import { projectFileMime } from './file-format';
import { createLogger } from '../utils/logger';

const log = createLogger('project-hub-copia');
const exists = () => new ProjectHubError('DESTINATION_EXISTS', 'Ya existe un archivo con ese nombre. Elige otro para guardar la copia.');
export async function prepareProjectDownloadDestination(selected: string, mime: string, assert: () => void) {
  assert();
  if (!path.isAbsolute(selected) || projectFileMime(path.extname(selected).slice(1).toLowerCase()) !== mime) {
    throw new ProjectHubError('INVALID_DESTINATION', 'Elige un destino con la extensión del archivo revisado.');
  }
  const originalDirectory = path.dirname(selected); const directory = await fs.realpath(originalDirectory); assert();
  const identity = await fs.lstat(directory); assert();
  if (!identity.isDirectory() || identity.isSymbolicLink()) throw new ProjectHubError('INVALID_DESTINATION', 'El directorio de destino no está disponible.');
  const target = path.join(directory, path.basename(selected));
  const sameDirectory = async () => {
    const stat = await fs.lstat(directory);
    return stat.isDirectory() && !stat.isSymbolicLink() && stat.dev === identity.dev && stat.ino === identity.ino
      && await fs.realpath(originalDirectory) === directory;
  };
  const available = async () => {
    assert(); if (!await sameDirectory()) throw new ProjectHubError('INVALID_DESTINATION', 'El directorio de destino cambió.'); assert();
    try { await fs.lstat(target); throw exists(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    assert();
  };
  await available();
  return {
    async publish(bytes: Buffer, published: () => void): Promise<void> {
      await available();
      const temporary = path.join(directory, `.soflia-download-${randomUUID()}.part`);
      let handle: fs.FileHandle | undefined; let created = false;
      try {
        handle = await fs.open(temporary, 'wx', 0o600); created = true; assert();
        await handle.writeFile(bytes); assert(); await handle.sync(); assert();
        await handle.close(); handle = undefined;
        await available(); assert();
        try { await fs.link(temporary, target); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw exists();
          throw new ProjectHubError('DOWNLOAD_COMMIT_UNCERTAIN', 'No se confirmó la publicación de la copia. Comprueba el destino elegido.');
        }
        // Desde este punto cancelar no retira la copia que el usuario aprobó.
        published(); assert();
      } finally {
        await handle?.close().catch(() => log.warn('No se confirmó el cierre del temporal de descarga.'));
        if (created) {
          try { if (await sameDirectory()) await fs.unlink(temporary); else log.warn('El directorio cambió; se conserva el temporal de descarga.'); }
          catch { log.warn('No se confirmó la retirada del temporal de descarga.'); }
        }
      }
    },
  };
}
