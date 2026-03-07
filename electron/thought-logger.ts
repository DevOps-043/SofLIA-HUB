import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

export interface ThoughtEvent {
  id: number;
  agent_id: string;
  task_id: string;
  thought_data: any;
  status?: string;
  context_dump?: any;
  update_time?: string;
  timestamp: string;
}

export type WorkerRestartCallback = (taskId: string, contextDump: any) => void;

export class Orchestrator {
  private db: any;
  private intervalId: NodeJS.Timeout | null = null;
  private workerRestartCallback: WorkerRestartCallback | null = null;

  constructor(db: any) {
    this.db = db;
  }

  public registerWorkerCallback(callback: WorkerRestartCallback) {
    this.workerRestartCallback = callback;
  }

  public start(timeoutMs: number = 60000, checkIntervalMs: number = 10000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.checkTasks(timeoutMs);
    }, checkIntervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkTasks(timeoutMs: number) {
    // Find tasks whose latest status is 'running' but update_time is too old
    const stmt = this.db.prepare(`
      SELECT e1.*
      FROM event_stream e1
      INNER JOIN (
        SELECT task_id, MAX(id) as max_id
        FROM event_stream
        GROUP BY task_id
      ) e2 ON e1.id = e2.max_id
      WHERE e1.status = 'running'
    `);
    
    const latestEvents = stmt.all();
    const now = Date.now();

    for (const event of latestEvents) {
      // SQLite CURRENT_TIMESTAMP is UTC format like 'YYYY-MM-DD HH:MM:SS'
      const timeStr = event.update_time 
        ? event.update_time.replace(' ', 'T') + 'Z' 
        : new Date().toISOString();
      
      const updateTime = new Date(timeStr).getTime();
      let timeDiff = now - updateTime;
      
      if (isNaN(timeDiff)) {
        timeDiff = now - new Date(event.update_time).getTime();
      }

      if (timeDiff > timeoutMs) {
        this.recoverTask(event);
      }
    }
  }

  private recoverTask(event: any) {
    const updateStmt = this.db.prepare(`
      UPDATE event_stream
      SET status = 'pending', update_time = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(event.id);

    if (this.workerRestartCallback) {
      const contextDump = event.context_dump ? JSON.parse(event.context_dump) : null;
      this.workerRestartCallback(event.task_id, contextDump);
    }
  }
}

export class ThoughtLogger {
  private db: any;
  public orchestrator: Orchestrator;

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
    
    this.orchestrator = new Orchestrator(this.db);
  }

  public async init(): Promise<void> {
    // Initialization left empty to prevent breaking any callers using await thoughtLogger.init()
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

    // Expand the table safely for existing databases
    try {
      this.db.exec(`ALTER TABLE event_stream ADD COLUMN status TEXT DEFAULT 'running'`);
    } catch (e) { /* ignore if exists */ }
    
    try {
      this.db.exec(`ALTER TABLE event_stream ADD COLUMN context_dump TEXT`);
    } catch (e) { /* ignore if exists */ }
    
    try {
      this.db.exec(`ALTER TABLE event_stream ADD COLUMN update_time DATETIME DEFAULT CURRENT_TIMESTAMP`);
    } catch (e) { /* ignore if exists */ }
  }

  /**
   * Logs a thought event to the event_stream table.
   * @param agentId The ID of the agent generating the thought
   * @param taskId The ID of the current task
   * @param thoughtData The structured thought data
   * @param status The current status of the task
   * @param contextDump Additional context state dump to recover if crashed
   */
  public logThought(agentId: string, taskId: string, thoughtData: any, status: string = 'running', contextDump: any = null): void {
    const stmt = this.db.prepare(`
      INSERT INTO event_stream (agent_id, task_id, thought_data, status, context_dump, update_time)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(agentId, taskId, JSON.stringify(thoughtData), status, contextDump ? JSON.stringify(contextDump) : null);
  }

  /**
   * Gets all thought events for a specific task in chronological order.
   * Useful for retrieving the exact context if the process crashes.
   * @param taskId The ID of the task to retrieve
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
      status: row.status,
      context_dump: row.context_dump ? JSON.parse(row.context_dump) : null,
      update_time: row.update_time,
      timestamp: row.timestamp
    }));
  }
}

// Export a singleton instance
export const thoughtLogger = new ThoughtLogger();
