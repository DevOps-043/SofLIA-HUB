/** Causa interna compatible con los targets TypeScript del renderer y main. */
export class PythonToolsError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause: unknown) { super(message); this.cause = cause; }
}
