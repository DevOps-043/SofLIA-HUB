import fs from 'node:fs/promises';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { BookmarkImportRejected, BrowserBookmarkStore, MAX_BOOKMARK_IMPORT_BYTES } from './bookmark-store';

interface BookmarkImportContext {
  scopeId: string;
  generation: number;
  changing: boolean;
  parent: BrowserWindow | null;
}

export interface BookmarkImportResult {
  cancelled: boolean;
  imported: number;
  updated: number;
  skipped: number;
  duplicates: number;
  invalid: number;
}

const cancelledResult = (): BookmarkImportResult => ({ cancelled: true, imported: 0, updated: 0, skipped: 0, duplicates: 0, invalid: 0 });

/** Selección y consentimiento nativos; el renderer sólo obtiene conteos. */
export class BrowserBookmarkImporter {
  private busy = false;

  constructor(
    private readonly store: BrowserBookmarkStore,
    private readonly getContext: () => BookmarkImportContext,
  ) {}

  async importFromDialog(): Promise<BookmarkImportResult> {
    if (this.busy) throw new BookmarkImportRejected('Ya hay una importación de marcadores en revisión.');
    const initial = { ...this.getContext() };
    const parent = initial.parent;
    const assertCurrent = () => {
      const current = this.getContext();
      if (!parent || parent.isDestroyed() || current.parent !== parent || current.changing
        || current.scopeId !== initial.scopeId || current.generation !== initial.generation) {
        throw new BookmarkImportRejected('El perfil o la ventana cambió durante la importación. Vuelve a intentarlo.');
      }
    };
    assertCurrent();
    if (!parent) throw new BookmarkImportRejected('El navegador no está iniciado.');
    this.busy = true;
    try {
      const selection = await dialog.showOpenDialog(parent, {
        title: 'Seleccionar marcadores para revisar', properties: ['openFile'],
        filters: [{ name: 'Marcadores HTML', extensions: ['html', 'htm'] }],
      });
      assertCurrent();
      if (selection.canceled || !selection.filePaths[0]) return cancelledResult();
      const html = await readBookmarkImportFile(selection.filePaths[0]);
      assertCurrent();
      const prepared = await this.store.prepareImportHtml(html);
      assertCurrent();
      const summary = prepared.summary;
      const counts = `${summary.newCount} nuevos; ${summary.duplicateCount} duplicados; ${summary.conflictCount} con cambios de título, carpeta o etiquetas; ${summary.invalidCount} inválidos.`;
      if (!summary.newCount && !summary.conflictCount) {
        await dialog.showMessageBox(parent, {
          type: 'info', title: 'Revisión de marcadores', message: 'No hay marcadores nuevos ni cambios por importar.',
          detail: counts, buttons: ['Cerrar'], defaultId: 0, cancelId: 0, noLink: true,
        });
        assertCurrent();
        return { cancelled: false, imported: 0, updated: 0, skipped: summary.total, duplicates: summary.duplicateCount, invalid: summary.invalidCount };
      }
      const decision = await dialog.showMessageBox(parent, {
        type: 'question', title: 'Revisar importación de marcadores',
        message: '¿Qué marcadores quieres importar?',
        detail: `${counts}\n\nImportar sólo nuevos conserva todos tus marcadores actuales. Actualizar conflictos reemplaza únicamente título, carpeta y etiquetas de las URLs que ya existen. Las entradas inválidas y las repeticiones del archivo se omiten. No se importan historial ni contraseñas.`,
        buttons: summary.conflictCount
          ? ['Importar sólo nuevos', 'Cancelar', 'Actualizar conflictos e importar']
          : ['Importar nuevos', 'Cancelar'],
        defaultId: 1, cancelId: 1, noLink: true,
      });
      assertCurrent();
      if (decision.response !== 0 && !(decision.response === 2 && summary.conflictCount)) return cancelledResult();
      const mode = decision.response === 2 ? 'update' : 'skip';
      const result = await prepared.commit(mode, assertCurrent);
      assertCurrent();
      return { cancelled: false, ...result,
        duplicates: summary.duplicateCount + (mode === 'skip' ? summary.conflictCount : 0), invalid: summary.invalidCount };
    } catch (error) {
      if (error instanceof BookmarkImportRejected) throw error;
      throw new BookmarkImportRejected('No se pudo completar la importación de marcadores. Vuelve a intentarlo.');
    } finally { this.busy = false; }
  }
}

/** Lee del mismo descriptor y reserva cuota + 1, incluso si el archivo crece. */
export async function readBookmarkImportFile(filename: string): Promise<string> {
  if (!['.html', '.htm'].includes(path.extname(filename).toLowerCase())) throw new BookmarkImportRejected('Selecciona un archivo de marcadores HTML.');
  try {
    const handle = await fs.open(filename, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error('not-file');
      if (stat.size > MAX_BOOKMARK_IMPORT_BYTES) throw new Error('over-quota');
      const buffer = Buffer.alloc(MAX_BOOKMARK_IMPORT_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await handle.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > MAX_BOOKMARK_IMPORT_BYTES) throw new Error('over-quota');
      return buffer.subarray(0, length).toString('utf8');
    } finally { await handle.close(); }
  } catch {
    // Ni rutas ni errores del sistema de archivos salen al renderer.
    throw new BookmarkImportRejected('No se pudo leer el archivo de marcadores. Debe ser un archivo HTML de hasta 5 MB.');
  }
}
