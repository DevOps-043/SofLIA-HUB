declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): any;
    all(...params: unknown[]): any[];
  }

  export default class Database {
    constructor(filename: string);
    pragma(statement: string): unknown;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
  }
}
