import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite local sobre el modulo `node:sqlite` que ya trae el Node incluido en
 * Electron.
 *
 * Sustituye a `better-sqlite3`, que es una extension nativa compilada contra la
 * ABI de V8: cada linea de Electron exige un binario distinto y publicarlos va
 * por detras de los lanzamientos. Electron 43 usa la ABI 148 y no existe
 * binario precompilado para ella, asi que el proyecto quedaba obligado a
 * compilar desde fuente con una cadena de C++ en cada equipo y en CI.
 *
 * `node:sqlite` viaja dentro del propio Electron: no hay ABI que casar, ni
 * reconstruccion, ni compilador. Se verifico que cubre lo que el producto usa,
 * incluidos FTS5 con tokenizer `porter`, WAL y ALTER TABLE.
 *
 * La superficie replica la de `better-sqlite3` (`pragma` y `transaction` no
 * existen en `node:sqlite`) para que los modulos que ya la consumian no tengan
 * que reescribirse.
 */

export interface SqliteRunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatement {
  run(...params: unknown[]): SqliteRunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  /** Equivalente a `better-sqlite3`: ejecuta el PRAGMA y devuelve sus filas. */
  pragma(statement: string): unknown[];
  /** Envuelve una funcion para que corra dentro de una transaccion. */
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  close(): void;
}

export function createSqliteDatabase(filename: string): SqliteDatabase {
  const db = new DatabaseSync(filename);
  return wrapSqliteDatabase(db);
}

export function wrapSqliteDatabase(db: DatabaseSync): SqliteDatabase {
  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => db.prepare(sql) as unknown as SqliteStatement,
    pragma(statement: string): unknown[] {
      // Un PRAGMA de consulta devuelve filas; uno de asignacion no devuelve
      // ninguna y en algunos casos no admite `prepare`.
      try {
        return db.prepare(`PRAGMA ${statement}`).all() as unknown[];
      } catch {
        db.exec(`PRAGMA ${statement}`);
        return [];
      }
    },
    transaction<T extends (...args: never[]) => unknown>(fn: T): T {
      return ((...args: Parameters<T>): ReturnType<T> => {
        db.exec('BEGIN');
        try {
          const result = fn(...args) as ReturnType<T>;
          db.exec('COMMIT');
          return result;
        } catch (error) {
          // El rollback puede fallar si la transaccion ya se cerro sola; el
          // error original es el que debe propagarse.
          try { db.exec('ROLLBACK'); } catch { /* transaccion ya cerrada */ }
          throw error;
        }
      }) as T;
    },
    close: () => db.close(),
  };
}
