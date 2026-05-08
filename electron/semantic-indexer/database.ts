import { createRequire } from 'node:module';
import * as fs from 'fs';

const requireNative = createRequire(import.meta.url);
const Database = requireNative('better-sqlite3');
export type BetterSqlite3Database = ReturnType<typeof Database>;

export function createIndexerDatabase(dbPath: string): BetterSqlite3Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  initializeSchema(db);
  return db;
}

function initializeSchema(db: BetterSqlite3Database): void {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
        filepath UNINDEXED,
        filename,
        content,
        tokenize="porter"
      );
    `);
    console.log('[SemanticIndexer] Schema initialized successfully');
  } catch (error) {
    console.error('[SemanticIndexer] Error initializing schema:', error);
    throw error;
  }
}

export function getDatabaseSizeBytes(dbPath: string): number {
  if (!fs.existsSync(dbPath)) return 0;
  return fs.statSync(dbPath).size;
}
