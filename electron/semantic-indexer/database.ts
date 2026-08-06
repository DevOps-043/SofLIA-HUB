import * as fs from 'fs';
import { createSqliteDatabase, type SqliteDatabase } from '../sqlite/database';

export type IndexerDatabase = SqliteDatabase;
/** Alias historico: el indexador se escribio contra la forma de better-sqlite3. */
export type BetterSqlite3Database = SqliteDatabase;

export function createIndexerDatabase(dbPath: string): IndexerDatabase {
  const db = createSqliteDatabase(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  initializeSchema(db);
  return db;
}

function initializeSchema(db: IndexerDatabase): void {
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
