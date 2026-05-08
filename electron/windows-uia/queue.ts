import type { WindowsUIAServiceCore } from './core';
import type { WindowsUIATaskOptions } from './types';

export async function executeQueuedTask(
  service: WindowsUIAServiceCore,
  task: string,
  options?: WindowsUIATaskOptions,
): Promise<string> {
  if (!service.apiKey) throw new Error('API key de Gemini no configurada para WindowsUIAService.');
  if (service.status === 'idle') return service.executeTaskInternal(task, options);

  return new Promise<string>((resolve, reject) => {
    service.queue.push({ task, options, resolve, reject });
    service.emit('task-queued', { task, queuePosition: service.queue.length, backend: 'windows_uia' });
  });
}

export function processQueue(service: WindowsUIAServiceCore): void {
  if (service.status !== 'idle' || service.queue.length === 0) return;
  const next = service.queue.shift();
  if (!next) return;
  service.executeTaskInternal(next.task, next.options).then(next.resolve).catch(next.reject);
}
