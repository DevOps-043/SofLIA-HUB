/**
 * Borrado logico de conversaciones visto desde el proceso main.
 *
 * El renderer marca `conversations.deleted_at` al borrar; este proceso solo
 * lee, asi que su unica obligacion es no ofrecer al agente una conversacion
 * que el usuario ya borro. Se tolera que la migracion
 * `database/lia/migrations/conversations-soft-delete.sql` no este aplicada:
 * en ese caso se repite la consulta sin el filtro en vez de fallar.
 */

export interface LiaErrorLike {
  code?: string;
  message?: string;
}

export function isMissingSoftDeleteColumn(error: LiaErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return typeof error.message === 'string' && error.message.includes('deleted_at');
}

let alreadyWarned = false;

export function warnMissingSoftDeleteColumn(): void {
  if (alreadyWarned) return;
  alreadyWarned = true;
  console.warn(
    '[app-chat] La columna conversations.deleted_at no existe en Supabase. ' +
    'Aplica database/lia/migrations/conversations-soft-delete.sql; hasta entonces este proceso ' +
    'puede listar conversaciones que el usuario borro.',
  );
}
