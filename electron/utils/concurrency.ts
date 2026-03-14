/**
 * Utilidades de concurrencia — Main Process
 * Extraído de autodev-service.ts para reutilización.
 */

/**
 * Ejecuta tareas en paralelo con un límite de concurrencia.
 * Cada tarea se identifica por nombre y retorna un resultado tipado.
 */
export async function runParallel<T>(
  tasks: Array<{ name: string; fn: () => Promise<T> }>,
  maxConcurrency: number,
  onTaskDone?: (name: string, result: T) => void,
): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const queue = [...tasks];

  const runNext = async (): Promise<void> => {
    const task = queue.shift();
    if (!task) return;
    try {
      console.log(`[Parallel] Iniciando: ${task.name}`);
      const result = await task.fn();
      results.set(task.name, result);
      onTaskDone?.(task.name, result);
      console.log(`[Parallel] Completado: ${task.name}`);
    } catch (err: any) {
      console.error(`[Parallel] Falló: ${task.name} — ${err.message}`);
      results.set(task.name, [] as any);
    }
    await runNext();
  };

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => runNext(),
  );
  await Promise.all(workers);
  return results;
}
