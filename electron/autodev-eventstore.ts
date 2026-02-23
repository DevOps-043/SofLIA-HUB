import Database, { type Database as DatabaseType } from 'better-sqlite3';

export interface AgentEvent {
  id: number;
  session_id: string;
  event_type: string;
  payload: any;
  timestamp: string;
}

export class EventStore {
  private db: DatabaseType;

  constructor(dbPath: string = 'autodev_events.sqlite') {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    // Initialize the agent_events table based on the required schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSON NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create an index for faster reconstruction of state by session and chronological sorting
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_events_session_id_timestamp 
      ON agent_events(session_id, timestamp)
    `);
  }

  /**
   * Appends a new event to the event store.
   * Typical eventTypes are 'step', 'tool_call', and 'tool_result'.
   */
  public appendEvent(
    sessionId: string,
    eventType: 'step' | 'tool_call' | 'tool_result' | string,
    payload: any
  ): AgentEvent {
    const stmt = this.db.prepare(`
      INSERT INTO agent_events (session_id, event_type, payload)
      VALUES (?, ?, ?)
    `);

    // Using JSON.stringify for the payload as required by the JSON field
    const result = stmt.run(sessionId, eventType, JSON.stringify(payload));

    const getStmt = this.db.prepare(`
      SELECT * FROM agent_events WHERE id = ?
    `);

    const row = getStmt.get(result.lastInsertRowid) as any;

    return {
      id: row.id,
      session_id: row.session_id,
      event_type: row.event_type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
    };
  }

  /**
   * Reconstructs the state of a session by reading all events chronologically.
   * If upToTimestamp is provided, it will only return events up to that point,
   * enabling 'rewind' functionality.
   */
  public reconstructState(sessionId: string, upToTimestamp?: string): AgentEvent[] {
    let query = 'SELECT * FROM agent_events WHERE session_id = ?';
    const params: any[] = [sessionId];

    if (upToTimestamp) {
      query += ' AND timestamp <= ?';
      params.push(upToTimestamp);
    }

    // Order by timestamp, then by ID to ensure consistent chronological order 
    // for events that might have been created at the exact same timestamp
    query += ' ORDER BY timestamp ASC, id ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      session_id: row.session_id,
      event_type: row.event_type,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
    }));
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}
