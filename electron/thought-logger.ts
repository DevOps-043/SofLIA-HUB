import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

export interface ThoughtEvent {
  id: number;
  agent_id: string;
  task_id: string;
  thought_data: any;
  timestamp: string;
}

export class ThoughtLogger {
  private db: any;

  constructor() {
    let dbPath = 'thoughts.db';
    try {
      // Use Electron's userData directory to store the database safely
      if (app && app.getPath) {
        dbPath = path.join(app.getPath('userData'), 'thoughts.db');
      } else {
        dbPath = path.join(process.cwd(), 'thoughts.db');
      }
    } catch (error) {
      dbPath = path.join(process.cwd(), 'thoughts.db');
    }
    
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_stream (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        thought_data TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Logs a thought event to the event_stream table.
   * @param agentId The ID of the agent generating the thought
   * @param taskId The ID of the current task
   * @param thoughtData The structured thought data
   */
  public logThought(agentId: string, taskId: string, thoughtData: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO event_stream (agent_id, task_id, thought_data)
      VALUES (?, ?, ?)
    `);
    stmt.run(agentId, taskId, JSON.stringify(thoughtData));
  }

  /**
   * Resumes a task by fetching all its recorded thought events in chronological order.
   * This allows retrieving the exact context if the process crashes, inspired by OpenHands.
   * @param taskId The ID of the task to resume
   * @returns An array of ThoughtEvent objects
   */
  public resumeTask(taskId: string): ThoughtEvent[] {
    const stmt = this.db.prepare(`
      SELECT * FROM event_stream
      WHERE task_id = ?
      ORDER BY timestamp ASC, id ASC
    `);
    
    const rows = stmt.all(taskId) as any[];
    
    return rows.map((row: any) => ({
      id: row.id,
      agent_id: row.agent_id,
      task_id: row.task_id,
      thought_data: JSON.parse(row.thought_data),
      timestamp: row.timestamp
    }));
  }
}

// Export a singleton instance
export const thoughtLogger = new ThoughtLogger();
