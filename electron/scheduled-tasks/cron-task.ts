import cron from 'node-cron';

import type { ScheduledTaskMeta } from './types';

export function createScheduledCronTask(
  meta: ScheduledTaskMeta,
  cancelTask: (taskId: string) => void,
  emitTask: (payload: { taskId: string; actionText: string; whatsappChatId: string }) => void,
) {
  return cron.schedule(
    meta.cronTime,
    () => {
      emitTask({ taskId: meta.id, actionText: meta.actionText, whatsappChatId: meta.whatsappChatId });
      if (meta.runOnce) cancelTask(meta.id);
    },
    { scheduled: true },
  );
}
