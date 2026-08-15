import fs from 'node:fs/promises';

import { normalizeScheduledTask } from './normalizer';
import type { ScheduledTaskInfo } from './types';

/**
 * Estado local del planificador.
 *
 * Ya NO se espeja en `hub_service_state`. Aquel espejo guardaba las tareas de
 * todos los usuarios de la misma base en UNA fila global sin `user_id`: la
 * ultima escritura ganaba y un usuario podia pisar las rutinas de otro. Las
 * Skills pasivas viven ahora en `public.passive_skills`, con dueno y RLS.
 *
 * Este archivo queda como CACHE DE ARRANQUE: `node-cron` tiene que levantar las
 * programaciones sin depender de la red, porque una rutina que no se ejecuta no
 * avisa de que no se ejecuto. Cuando la base responde, manda ella y
 * `PassiveSkillsService` reconcilia.
 */

export async function loadScheduledTasks(statePath: string): Promise<Map<string, ScheduledTaskInfo>> {
  const tasks = new Map<string, ScheduledTaskInfo>();
  try {
    const data = await fs.readFile(statePath, 'utf-8');
    const loadedTasks = JSON.parse(data) as Array<Partial<ScheduledTaskInfo>>;
    for (const task of loadedTasks) {
      const normalized = normalizeScheduledTask(task);
      tasks.set(normalized.id, normalized);
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error('[TaskScheduler] Error cargando estado:', err.message);
    }
  }
  return tasks;
}

export async function saveScheduledTasks(statePath: string, tasks: Iterable<ScheduledTaskInfo>): Promise<void> {
  try {
    await fs.writeFile(statePath, JSON.stringify(Array.from(tasks), null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[TaskScheduler] Error guardando estado:', err.message);
  }
}
