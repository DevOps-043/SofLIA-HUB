import { createSqliteDatabase, type SqliteDatabase } from '../sqlite/database';

export type MemoryDatabaseConstructor = new (filename: string) => SqliteDatabase;

/**
 * La memoria se abre sobre `node:sqlite`, incluido en Electron. Se conserva la
 * forma de constructor porque los consumidores la instancian con `new`.
 */
export function getDatabaseConstructor(): MemoryDatabaseConstructor {
  return class {
    constructor(filename: string) {
      return createSqliteDatabase(filename) as unknown as this;
    }
  } as unknown as MemoryDatabaseConstructor;
}
