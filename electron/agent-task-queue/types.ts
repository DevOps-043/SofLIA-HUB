export type TaskStatus = 'pending' | 'running' | 'retrying' | 'cancelled' | 'completed' | 'failed';

export interface ActiveTask {
  id: string;
  name: string;
  controller: AbortController;
  status: TaskStatus;
  startTime: number;
  attempts: number;
}
