/**
 * Clasificacion de los fallos de escritura contra Supabase.
 *
 * La cola de estado pendiente reintenta lo que falla, y eso es correcto para una
 * red intermitente. Pero hay fallos que NUNCA van a cambiar de respuesta, y
 * reintentarlos es un bucle: la fila se queda en la cola, cada guardado la
 * vuelve a enviar y el registro de la base de datos se llena de rechazos.
 *
 * Ocurrio de verdad: miles de `42501 new row violates row-level security policy`
 * por hora sobre `conversations` y `messages`. Una conversacion creada bajo una
 * identidad anterior seguia en Supabase con SU dueño, mientras la copia local la
 * reclamaba para la identidad activa. RLS la rechazaba —correctamente— y la cola
 * no tenia forma de rendirse.
 */

/** Codigos que no van a cambiar por reintentar. */
const PERMANENTES: ReadonlySet<string> = new Set([
  // Sin permiso: la fila pertenece a otra identidad o la politica no la admite.
  '42501',
  // Viola una clave foranea: la conversacion padre no existe ni va a aparecer.
  '23503',
  // Rompe una restriccion de unicidad que un reintento repetiria igual.
  '23505',
  // Violacion de restriccion de comprobacion.
  '23514',
  // Texto que no es del tipo esperado, por ejemplo un uuid mal formado.
  '22P02',
]);

export interface RemoteWriteError {
  code?: string | null;
  message?: string | null;
}

export function isPermanentWriteError(error: RemoteWriteError | null | undefined): boolean {
  const code = String(error?.code ?? '').trim();
  return PERMANENTES.has(code);
}

/**
 * Resultado de una escritura remota. `permanente` distingue "ahora no se pudo"
 * de "esto no se va a poder": lo primero se reintenta, lo segundo se abandona.
 */
export type RemoteWriteOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; permanente: boolean; message: string };

export function toWriteFailure(error: RemoteWriteError | null | undefined): {
  ok: false;
  permanente: boolean;
  message: string;
} {
  return {
    ok: false,
    permanente: isPermanentWriteError(error),
    message: String(error?.message ?? 'Error desconocido al escribir en Supabase.'),
  };
}
