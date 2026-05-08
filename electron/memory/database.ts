import { createRequire } from 'node:module';

export type BetterSqlite3Constructor = new (filename: string, options?: Record<string, unknown>) => any;

const requireFromModule = createRequire(import.meta.url);
let Database: BetterSqlite3Constructor | null = null;

export function getDatabaseConstructor(): BetterSqlite3Constructor {
  if (!Database) {
    Database = requireFromModule('better-sqlite3') as BetterSqlite3Constructor;
  }
  return Database;
}
