import type { WindowsUIAServiceCore } from './core';
import { AsyncResource } from 'node:async_hooks';
import type { WindowsUIATaskOptions } from './types';

export async function executeQueuedTask(
  service: WindowsUIAServiceCore,
  task: string,
  options?: WindowsUIATaskOptions,
): Promise<string> {
  if (service.status === 'idle') return service.executeTaskInternal(task, options);

  return new Promise<string>((resolve, reject) => {
    service.queue.push({ task, options, resolve, reject, execute: AsyncResource.bind(() => {
      if (options?.signal?.aborted) return Promise.reject(new Error('Tarea UIA revocada antes de ejecutar.'));
      return service.executeTaskInternal(task, options);
    }) });
    service.emit('task-queued', { task, queuePosition: service.queue.length, backend: 'windows_uia' });
  });
}

export function processQueue(service: WindowsUIAServiceCore): void {
  if (service.status !== 'idle' || service.queue.length === 0) return;
  const next = service.queue.shift();
  if (!next) return;
  try {
    const running = next.execute ? next.execute() : service.executeTaskInternal(next.task, next.options);
    running.then(next.resolve).catch(next.reject);
  } catch { next.reject(new Error('No se pudo admitir la tarea UIA en cola.')); }
}
