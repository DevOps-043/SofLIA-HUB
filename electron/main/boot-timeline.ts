// Instrumentacion de arranque del proceso principal.
// Registra hitos con tiempo relativo al arranque y duracion entre hitos, como
// log estructurado en espanol con el prefijo [BOOT] ya usado en el bootstrap.
// Es la fuente de evidencia para fijar y verificar presupuestos de arranque
// (ver docs/architecture/runtime-parameters.md). No incluye datos personales ni
// secretos: solo nombres de fase y milisegundos.

const startedAt = performance.now();
let lastAt = startedAt;

/** Registra un hito de arranque con su tiempo relativo y la duracion desde el hito previo. */
export function markBoot(fase: string): void {
  const now = performance.now();
  const tRelativoMs = Math.round(now - startedAt);
  const duracionMs = Math.round(now - lastAt);
  lastAt = now;
  console.log(`[BOOT] hito fase=${fase} t_relativo_ms=${tRelativoMs} duracion_ms=${duracionMs}`);
}

/** Milisegundos transcurridos desde el inicio del proceso principal. */
export function bootElapsedMs(): number {
  return Math.round(performance.now() - startedAt);
}
