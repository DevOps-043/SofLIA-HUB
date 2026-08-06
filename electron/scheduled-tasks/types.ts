import type { ScheduledTask as CronScheduledTask } from 'node-cron';

export interface ScheduledTaskMeta {
  id: string;
  cronTime: string;
  actionText: string;
  whatsappChatId: string;
  runOnce: boolean;
  createdAt: number;
}

export interface ScheduledTask extends ScheduledTaskMeta {
  task: CronScheduledTask;
}

export interface ScheduledTasksConfig {
  storagePath: string;
}

export interface ScheduledTasksStatus {
  activeTasksCount: number;
  isRunning: boolean;
}
