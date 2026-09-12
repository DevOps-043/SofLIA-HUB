import fs from 'node:fs';
import path from 'node:path';

export const syncRecoveryMarker = (root: string) => path.join(root, 'sync-recovery.pending.bin');
/** Una recuperación interrumpida bloquea nuevas transferencias, incluso después de reiniciar. */
export function assertSyncRecoveryAvailable(root: string): void {
  try { fs.lstatSync(syncRecoveryMarker(root)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  throw new Error('Hay una recuperación local incompleta. Revierte la recuperación desde soporte antes de sincronizar.');
}
