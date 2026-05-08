import type { AgentTaskQueue } from '../../agent-task-queue';

export type AgentTaskQueueTestContext = {
  getQueue: () => AgentTaskQueue;
};
