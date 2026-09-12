import { dialog, type BrowserWindow } from 'electron';
import type { BrowserCredentialVault } from './credential-vault';
import type { BrowserCredentialSaveInput } from './types';
import { BrowserCredentialError } from './credential-errors';

/** Coordina guardados revisados por la persona; el consentimiento no viaja por IPC. */
export class BrowserCredentialSaver {
  private pending = false;
  constructor(private readonly vault: BrowserCredentialVault) {}

  async save(input: BrowserCredentialSaveInput, context: {
    origin: string; parent: BrowserWindow; assertCurrent: () => void; beginReview?: () => void;
  }, suggested = false) {
    if (this.pending) throw new BrowserCredentialError('Ya hay un guardado de credencial pendiente.');
    this.pending = true;
    try {
      context.assertCurrent();
      const prepared = await this.vault.prepareSave(context.origin, input);
      context.assertCurrent();
      if (suggested && prepared.unchanged) return { canceled: true };
      if (suggested) {
        // Permite terminar el envío. El secreto ya está cifrado en la preparación.
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        context.assertCurrent();
      }
      if (prepared.updating || suggested) {
        context.beginReview?.(); context.assertCurrent();
        const result = await dialog.showMessageBox(context.parent, {
          type: 'question', title: prepared.updating ? 'Actualizar contraseña guardada' : 'Guardar contraseña',
          message: prepared.updating ? '¿Actualizar esta cuenta?' : '¿Guardar esta cuenta en la bóveda local?',
          detail: `Sitio: ${prepared.origin}\nCuenta: ${prepared.username}\n\n${suggested ? 'Se detectó un intento de acceso; no se verificó que fuera exitoso. Se guardará sólo para el sitio indicado, aunque hayas sido redirigido a otro. ' : ''}${prepared.updating ? 'Se reemplazará la contraseña guardada de esta cuenta.' : 'La cuenta se guardará cifrada en este perfil.'}`,
          buttons: ['Cancelar', prepared.updating ? 'Actualizar contraseña' : 'Guardar contraseña'], defaultId: 0, cancelId: 0, noLink: true,
        });
        if (result.response !== 1) return { canceled: true };
        context.assertCurrent();
      }
      const credential = await prepared.commit(context.assertCurrent);
      context.assertCurrent();
      return { canceled: false, credential };
    } finally { this.pending = false; }
  }
}
