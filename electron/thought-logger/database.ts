import path from 'node:path';
import { app } from 'electron';
import { createSqliteDatabase, type SqliteDatabase } from '../sqlite/database';

export function createThoughtDatabase(): SqliteDatabase {
  const db = createSqliteDatabase(resolveThoughtDbPath());
  initThoughtDatabase(db);
  return db;
}

function resolveThoughtDbPath(): string {
  try {
    if (app?.getPath) return path.join(app.getPath('userData'), 'thoughts.db');
  } catch {
    // fallback below
  }
  return path.join(process.cwd(), 'thoughts.db');
}

function initThoughtDatabase(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_stream (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      thought_data TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  addColumnIfMissing(db, `ALTER TABLE event_stream ADD COLUMN status TEXT DEFAULT 'running'`);
  addColumnIfMissing(db, `ALTER TABLE event_stream ADD COLUMN context_dump TEXT`);
  addColumnIfMissing(db, `ALTER TABLE event_stream ADD COLUMN update_time DATETIME DEFAULT CURRENT_TIMESTAMP`);
}

function addColumnIfMissing(db: SqliteDatabase, sql: string): void {
  try {
    db.exec(sql);
  } catch {
    // La columna ya existe en bases previas.
  }
}
