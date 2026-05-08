import cron from 'node-cron';
import fs from 'node:fs/promises';

import type { ScheduledTask, ScheduledTaskMeta } from './types';

export async function loadScheduledTaskMap(storagePath: string): Promise<Map<string, ScheduledTask>> {
  const tasks = new Map<string, ScheduledTask>();
  try {
    const savedTasks = JSON.parse(await fs.readFile(storagePath, 'utf-8')) as ScheduledTaskMeta[];
    for (const meta of savedTasks) {
      if (cron.validate(meta.cronTime)) tasks.set(meta.id, { ...meta, task: null as any });
      else console.warn(`[ScheduledTasksService] Expresion cron invalida saltada: ${meta.cronTime}`);
    }
    console.log(`[ScheduledTasksService] Se cargaron ${tasks.size} tareas programadas de disco.`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') console.error('[ScheduledTasksService] Error cargando tareas programadas:', err);
    else console.log('[ScheduledTasksService] Archivo de tareas no encontrado (nuevo inicio).');
  }
  return tasks;
}

export async function saveScheduledTaskMap(storagePath: string, tasks: Iterable<ScheduledTask>): Promise<void> {
  try {
    const metadataList = Array.from(tasks).map(({ task: _task, ...meta }) => meta);
    await fs.writeFile(storagePath, JSON.stringify(metadataList, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ScheduledTasksService] Error guardando tareas:', err);
  }
}
