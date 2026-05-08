import type { WorkerRestartCallback } from './types';

export class Orchestrator {
  private intervalId: NodeJS.Timeout | null = null;
  private workerRestartCallback: WorkerRestartCallback | null = null;

  constructor(private readonly db: any) {}

  registerWorkerCallback(callback: WorkerRestartCallback): void {
    this.workerRestartCallback = callback;
  }

  start(timeoutMs = 60000, checkIntervalMs = 10000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.checkTasks(timeoutMs), checkIntervalMs);
  }

  stop(): void {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private checkTasks(timeoutMs: number): void {
    const latestEvents = this.db.prepare(`
      SELECT e1.*
      FROM event_stream e1
      INNER JOIN (
        SELECT task_id, MAX(id) as max_id
        FROM event_stream
        GROUP BY task_id
      ) e2 ON e1.id = e2.max_id
      WHERE e1.status = 'running'
    `).all();

    const now = Date.now();
    for (const event of latestEvents) {
      if (now - parseUpdateTime(event.update_time) > timeoutMs) {
        this.recoverTask(event);
      }
    }
  }

  private recoverTask(event: any): void {
    this.db.prepare(`
      UPDATE event_stream
      SET status = 'pending', update_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(event.id);

    if (!this.workerRestartCallback) return;
    const contextDump = event.context_dump ? JSON.parse(event.context_dump) : null;
    this.workerRestartCallback(event.task_id, contextDump);
  }
}

function parseUpdateTime(updateTime?: string): number {
  if (!updateTime) return Date.now();
  const utcTime = new Date(`${updateTime.replace(' ', 'T')}Z`).getTime();
  return Number.isNaN(utcTime) ? new Date(updateTime).getTime() : utcTime;
}
