/**
 * Contrato del borrado logico de conversaciones.
 *
 * Borrar una conversacion no elimina su fila: marca `conversations.deleted_at`.
 * Esa marca es lo unico que viaja entre equipos, porque las lapidas locales
 * (`src/services/chat/tombstones.ts`) viven en el `localStorage` de un solo
 * dispositivo y no explican a los demas que el usuario ya borro ese chat.
 *
 * El cliente tolera que la migracion `database/lia/migrations/
 * conversations-soft-delete.sql` todavia no este aplicada: si la columna no
 * existe, las lecturas reintentan sin el filtro y el borrado vuelve a ser solo
 * local, avisando una vez en consola. Sin esa tolerancia, publicar el cliente
 * antes que la migracion dejaria el listado de chats en modo degradado.
 */

export interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

/**
 * `42703` es "columna inexistente" de Postgres (lecturas) y `PGRST204` es la
 * columna ausente en el cache de esquema de PostgREST (escrituras).
 */
export function isMissingSoftDeleteColumn(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return typeof error.message === 'string' && error.message.includes('deleted_at');
}

let alreadyWarned = false;

export function warnMissingSoftDeleteColumn(context: string): void {
  if (alreadyWarned) return;
  alreadyWarned = true;
  console.warn(
    `[chat-service] ${context}: la columna conversations.deleted_at no existe en Supabase. ` +
    'Aplica database/lia/migrations/conversations-soft-delete.sql; hasta entonces los borrados ' +
    'solo se recuerdan en este equipo.',
  );
}

/** Solo para pruebas: reinicia el aviso unico. */
export function resetSoftDeleteWarning(): void {
  alreadyWarned = false;
}
