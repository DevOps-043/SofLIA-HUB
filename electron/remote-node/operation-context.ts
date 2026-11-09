/** Autoridad interna main; nunca se serializa ni se acepta desde IPC. */
export interface RemoteNodeOperationContext {
  assertCurrent(): void;
  signal?: AbortSignal;
  onDispatch?(): void;
}
