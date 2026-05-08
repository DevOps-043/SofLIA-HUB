import { createThoughtDatabase } from './thought-logger/database';
import { Orchestrator } from './thought-logger/orchestrator';
import type { ThoughtEvent } from './thought-logger/types';

export type {
  ThoughtEvent,
  WorkerRestartCallback,
} from './thought-logger/types';
export { Orchestrator } from './thought-logger/orchestrator';

export class ThoughtLogger {
  private db: any;
  public orchestrator: Orchestrator;

  constructor() {
    this.db = createThoughtDatabase();
    this.orchestrator = new Orchestrator(this.db);
  }

  logThought(
    agentId: string,
    taskId: string,
    thoughtData: any,
    status = 'running',
    contextDump: any = null,
  ): void {
    this.db.prepare(`
      INSERT INTO event_stream (agent_id, task_id, thought_data, status, context_dump, update_time)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(agentId, taskId, JSON.stringify(thoughtData), status, contextDump ? JSON.stringify(contextDump) : null);
  }

  resumeTask(taskId: string): ThoughtEvent[] {
    const rows = this.db.prepare(`
      SELECT * FROM event_stream
      WHERE task_id = ?
      ORDER BY timestamp ASC, id ASC
    `).all(taskId) as any[];

    return rows.map((row) => ({
      id: row.id,
      agent_id: row.agent_id,
      task_id: row.task_id,
      thought_data: JSON.parse(row.thought_data),
      status: row.status,
      context_dump: row.context_dump ? JSON.parse(row.context_dump) : null,
      update_time: row.update_time,
      timestamp: row.timestamp,
    }));
  }
}

export const thoughtLogger = new ThoughtLogger();
