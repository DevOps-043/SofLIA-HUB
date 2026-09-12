import type { DatabaseSync } from 'node:sqlite';

/** Creación v0→v1 atómica. Una base ajena, futura o incompleta nunca se repara destruyendo datos. */
export function initializeBrowserSchema(db: DatabaseSync, create: () => void, validate: () => void): void {
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version);
  if (!Number.isInteger(version) || version < 0 || version > 1) throw new Error('El almacén pertenece a una versión no compatible. Se conserva el archivo.');
  if (version === 1) { validate(); return; }
  db.exec('BEGIN IMMEDIATE');
  try {
    // Se vuelve a leer bajo bloqueo para no migrar una versión publicada por otro proceso.
    const current = Number(db.prepare('PRAGMA user_version').get()?.user_version);
    if (current === 0) {
      const objects = Number(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get()?.count);
      if (objects) throw new Error('El almacén sin versión contiene datos. Se conserva para recuperación.');
      create(); validate(); db.exec('PRAGMA user_version=1');
    } else if (current === 1) validate();
    else throw new Error('La versión del almacén cambió durante la migración.');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
