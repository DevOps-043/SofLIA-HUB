import fs from 'node:fs/promises';

import { normalizeScheduledTask } from './normalizer';
import type { ScheduledTaskInfo } from './types';

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
