import fs from 'node:fs/promises';
import path from 'node:path';
import { app, dialog, type BrowserWindow } from 'electron';
import {
  BrowserCredentialVault,
  MAX_CREDENTIAL_TRANSFER_BYTES,
  type BrowserCredentialTransferEntry,
} from './credential-vault';
import { BrowserCredentialError } from './credential-errors';

type TransferFile = { version: 1; credentials: BrowserCredentialTransferEntry[] };

export interface CredentialTransferContext {
  parent: BrowserWindow | null;
  assertCurrent: () => void;
}

export interface CredentialTransferResult {
  cancelled: boolean;
  imported?: number;
  updated?: number;
  skipped?: number;
  exported?: number;
}

/** Diálogos nativos para que los secretos nunca crucen IPC ni lleguen al renderer. */
export class BrowserCredentialTransfer {
  private busy = false;

  constructor(private readonly vault: BrowserCredentialVault) {}

  async exportToDialog(context: CredentialTransferContext): Promise<CredentialTransferResult> {
    return this.runExclusive(async () => {
      const parent = requireParent(context);
      const metadata = await this.vault.list();
      context.assertCurrent();
      const warning = await dialog.showMessageBox(parent, {
        type: 'warning',
        title: 'Exportar contraseñas',
        message: 'El archivo contendrá contraseñas en texto legible.',
        detail: `${metadata.length} credencial${metadata.length === 1 ? '' : 'es'} se exportará${metadata.length === 1 ? '' : 'n'} a una ubicación que tú elegirás. Protégelo y elimínalo después de usarlo.`,
        buttons: ['Cancelar', 'Elegir destino y exportar'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      context.assertCurrent();
      if (warning.response !== 1) return { cancelled: true };
      const selection = await dialog.showSaveDialog(parent, {
        title: 'Guardar exportación de contraseñas',
        defaultPath: path.join(app.getPath('documents'), 'credenciales-soflia.json'),
        filters: [{ name: 'Exportación de contraseñas', extensions: ['json'] }],
      });
      context.assertCurrent();
      if (selection.canceled || !selection.filePath) return { cancelled: true };
      const entries = await this.vault.exportTransfer();
      context.assertCurrent();
      const destination = selection.filePath.toLocaleLowerCase('es').endsWith('.json') ? selection.filePath : `${selection.filePath}.json`;
      const payload: TransferFile = { version: 1, credentials: entries };
      const serialized = JSON.stringify(payload, null, 2);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_CREDENTIAL_TRANSFER_BYTES) throw new BrowserCredentialError('La exportación supera el tamaño permitido.');
      await fs.writeFile(destination, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      context.assertCurrent();
      return { cancelled: false, exported: entries.length };
    });
  }

  async importFromDialog(context: CredentialTransferContext): Promise<CredentialTransferResult> {
    return this.runExclusive(async () => {
      const parent = requireParent(context);
      const selection = await dialog.showOpenDialog(parent, {
        title: 'Seleccionar contraseñas para revisar',
        properties: ['openFile'],
        filters: [{ name: 'Exportación de contraseñas', extensions: ['json'] }],
      });
      context.assertCurrent();
      if (selection.canceled || !selection.filePaths[0]) return { cancelled: true };
      const transfer = await readCredentialTransferFile(selection.filePaths[0]);
      context.assertCurrent();
      const prepared = await this.vault.prepareImport(transfer.credentials);
      context.assertCurrent();
      const summary = prepared.summary;
      const counts = `${summary.newCount} nuevas; ${summary.conflictCount} conflictos; ${summary.duplicateCount} repetidas; ${summary.invalidCount} inválidas.`;
      if (!summary.newCount && !summary.conflictCount) {
        await dialog.showMessageBox(parent, { type: 'info', title: 'Revisión de contraseñas', message: 'No hay credenciales nuevas ni conflictos por importar.', detail: counts, buttons: ['Cerrar'], defaultId: 0, cancelId: 0, noLink: true });
        context.assertCurrent();
        return { cancelled: false, imported: 0, updated: 0, skipped: summary.total };
      }
      const decision = await dialog.showMessageBox(parent, {
        type: 'question',
        title: 'Revisar importación de contraseñas',
        message: '¿Qué credenciales quieres importar?',
        detail: `${counts}\n\nImportar sólo nuevas conserva tus contraseñas actuales. Actualizar conflictos reemplaza la contraseña de la misma cuenta y origen.`,
        buttons: summary.conflictCount ? ['Importar sólo nuevas', 'Cancelar', 'Actualizar conflictos e importar'] : ['Importar nuevas', 'Cancelar'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
      });
      context.assertCurrent();
      if (decision.response !== 0 && !(decision.response === 2 && summary.conflictCount)) return { cancelled: true };
      const mode = decision.response === 2 ? 'update' : 'skip';
      const result = await prepared.commit(mode, context.assertCurrent);
      context.assertCurrent();
      return { cancelled: false, ...result };
    });
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new BrowserCredentialError('Ya hay una transferencia de contraseñas en revisión.');
    this.busy = true;
    try { return await operation(); }
    catch (error) {
      if (error instanceof BrowserCredentialError) throw error;
      throw new BrowserCredentialError('No se pudo completar la transferencia de contraseñas. Vuelve a intentarlo.');
    }
    finally { this.busy = false; }
  }
}

export async function readCredentialTransferFile(filename: string): Promise<TransferFile> {
  if (path.extname(filename).toLowerCase() !== '.json') throw new BrowserCredentialError('Selecciona una exportación JSON de contraseñas.');
  try {
    const handle = await fs.open(filename, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_CREDENTIAL_TRANSFER_BYTES) throw new Error('invalid-file');
      const buffer = Buffer.alloc(MAX_CREDENTIAL_TRANSFER_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const chunk = await handle.read(buffer, length, buffer.length - length, null);
        if (!chunk.bytesRead) break;
        length += chunk.bytesRead;
      }
      if (length > MAX_CREDENTIAL_TRANSFER_BYTES) throw new Error('over-quota');
      const parsed = JSON.parse(buffer.subarray(0, length).toString('utf8')) as Partial<TransferFile>;
      if (parsed.version !== 1 || !Array.isArray(parsed.credentials) || parsed.credentials.length > 500) throw new Error('invalid-shape');
      return { version: 1, credentials: parsed.credentials as BrowserCredentialTransferEntry[] };
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof BrowserCredentialError) throw error;
    throw new BrowserCredentialError('No se pudo leer la exportación. Debe ser un JSON de hasta 5 MB.');
  }
}

function requireParent(context: CredentialTransferContext): BrowserWindow {
  context.assertCurrent();
  if (!context.parent || context.parent.isDestroyed()) throw new BrowserCredentialError('El navegador no está iniciado.');
  return context.parent;
}
