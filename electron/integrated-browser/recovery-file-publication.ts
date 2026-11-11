import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

/** Publicación síncrona interna; las guardas, formatos y borrados deliberados pertenecen al motor. */
export function publishRecoveryFile(file: string, data: Buffer, guard: () => void, exclusive = false): void {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let created = false; let published = false;
  try {
    guard(); const descriptor = fs.openSync(temporary, 'wx', 0o600); created = true;
    let failure: { cause: unknown } | undefined;
    try { fs.writeFileSync(descriptor, data); fs.fsyncSync(descriptor); }
    catch (cause) { failure = { cause }; }
    try { fs.closeSync(descriptor); }
    catch (cause) {
      console.warn('[Navegador][Persistencia] Falló el cierre del temporal; su estado no está confirmado.');
      // No reintentar un descriptor incierto ni sustituir el fallo de escritura/fsync.
      failure ??= { cause };
    }
    if (failure) throw failure.cause;
    guard();
    if (exclusive) fs.linkSync(temporary, file); else fs.renameSync(temporary, file);
    published = true;
  } finally {
    if (created) {
      try { fs.unlinkSync(temporary); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(published
          ? '[Navegador][Persistencia] Archivo publicado; quedó un temporal propio pendiente de limpieza.'
          : '[Navegador][Persistencia] Archivo no publicado; quedó un temporal propio pendiente de limpieza.');
      }
    }
  }
}
