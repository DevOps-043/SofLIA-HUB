import fs from 'node:fs/promises';

import { mirrorHubStateFile, restoreHubStateFile } from '../hub-state-store';
import { normalizeScheduledTask } from './normalizer';
import type { ScheduledTaskInfo } from './types';

const HUB_STATE_SERVICE_NAME = 'task-scheduler';

export async function loadScheduledTasks(statePath: string): Promise<Map<string, ScheduledTaskInfo>> {
  // Primero la base del Hub: las tareas programadas sobreviven formateos.
  await restoreHubStateFile(HUB_STATE_SERVICE_NAME, statePath);
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
    mirrorHubStateFile(HUB_STATE_SERVICE_NAME, statePath);
  } catch (err: any) {
    console.error('[TaskScheduler] Error guardando estado:', err.message);
  }
}
